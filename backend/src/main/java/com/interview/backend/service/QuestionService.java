package com.interview.backend.service;

import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final CacheMissLogger cacheMissLogger;

    @Cacheable("questionById")
    public Optional<Question> getById(String id) {
        cacheMissLogger.record("questionById", id);
        return questionRepository.findById(id);
    }

    public Page<Question> searchQuestions(boolean restrict, List<String> allowedTechs,
                                          String tech, String category, String difficulty, String company,
                                          String search, String status, List<String> visitedIds, List<String> readIds, List<String> flaggedIds, List<String> importantIds, Pageable pageable) {
        // Provide empty lists if null to avoid JPQL IN clause issues
        List<String> v = visitedIds != null ? visitedIds : List.of();
        List<String> r = readIds != null ? readIds : List.of();
        List<String> f = flaggedIds != null ? flaggedIds : List.of();
        List<String> i = importantIds != null ? importantIds : List.of();
        // Extract numeric search for exact displayNumber match (e.g., "169" or "Q169")
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase();
        Integer searchNumber = null;
        if (normalizedSearch != null) {
            String numPart = normalizedSearch.replaceAll("^q", "");
            try { searchNumber = Integer.parseInt(numPart); } catch (NumberFormatException ignored) {}
        }
        return questionRepository.searchQuestions(restrict, allowedTechs, tech, category, difficulty, company, normalizedSearch, searchNumber, status, v, r, f, i, pageable);
    }

    @Cacheable("categories")
    public List<String> getCategoriesByTech(String tech) {
        cacheMissLogger.record("categories", tech);
        return questionRepository.findCategoriesByTech(tech);
    }

    @Cacheable(value = "stats", key = "'total'")
    public long getTotalCount() {
        cacheMissLogger.record("stats", "total");
        return questionRepository.countAll();
    }

    @Cacheable(value = "stats", key = "#tech")
    public long getCountByTech(String tech) {
        cacheMissLogger.record("stats", tech);
        return questionRepository.countByTech(tech);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "questionSearch", allEntries = true),
            @CacheEvict(value = "categories", allEntries = true),
            @CacheEvict(value = "stats", allEntries = true),
            @CacheEvict(value = "questionById", allEntries = true)
    })
    public Question save(Question question) {
        return questionRepository.save(question);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "questionSearch", allEntries = true),
            @CacheEvict(value = "categories", allEntries = true),
            @CacheEvict(value = "stats", allEntries = true),
            @CacheEvict(value = "questionById", allEntries = true)
    })
    public List<Question> saveAll(List<Question> questions) {
        return questionRepository.saveAll(questions);
    }

    public boolean existsById(String id) {
        return questionRepository.existsById(id);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "questionSearch", allEntries = true),
            @CacheEvict(value = "categories", allEntries = true),
            @CacheEvict(value = "stats", allEntries = true),
            @CacheEvict(value = "questionById", allEntries = true)
    })
    public List<Question> createFromInputs(List<com.interview.backend.dto.QuestionInput> inputs) {
        int sortKey = questionRepository.maxSortKey();
        // Track the running max number per tech so a bulk push assigns sequential numbers.
        java.util.Map<String, Integer> nextNumber = new java.util.HashMap<>();
        // Ids are tracked separately from numbers: imported rows have ids whose suffix
        // does not match their `number`, so deriving one from the other collides.
        java.util.Map<String, Integer> nextIdSuffix = new java.util.HashMap<>();
        java.util.Set<String> takenInBatch = new java.util.HashSet<>();
        List<Question> toSave = new java.util.ArrayList<>();

        for (com.interview.backend.dto.QuestionInput in : inputs) {
            if (in.tech() == null || in.tech().isBlank())
                throw new IllegalArgumentException("tech is required");
            if (in.title() == null || in.title().isBlank())
                throw new IllegalArgumentException("title is required");
            if (in.answer() == null || in.answer().isBlank())
                throw new IllegalArgumentException("answer is required");

            String tech = in.tech().trim().toLowerCase();
            int number = nextNumber.computeIfAbsent(tech, questionRepository::maxNumberByTech) + 1;
            nextNumber.put(tech, number);
            sortKey++;

            final String id;
            if (in.id() != null && !in.id().isBlank()) {
                // Explicit id from the caller: a clash is their mistake, so report it.
                id = in.id().trim();
                if (takenInBatch.contains(id) || questionRepository.existsById(id))
                    throw new IllegalArgumentException("Question id already exists: " + id);
            } else {
                // Auto id: start past the highest suffix already in use, then step
                // forward until a free one is found (gaps and odd imports are common).
                int suffix = nextIdSuffix.computeIfAbsent(tech, questionRepository::maxIdSuffixByTech);
                String candidate;
                do {
                    suffix++;
                    candidate = tech + "-" + suffix;
                } while (takenInBatch.contains(candidate) || questionRepository.existsById(candidate));
                nextIdSuffix.put(tech, suffix);
                id = candidate;
            }
            takenInBatch.add(id);

            String questionText = (in.question() == null || in.question().isBlank()) ? in.title() : in.question();

            toSave.add(Question.builder()
                    .id(id)
                    .number(number)
                    .displayNumber(number)
                    .sortKey(sortKey)
                    .title(in.title().trim())
                    .question(questionText)
                    .answer(normalizeMarkdown(in.answer()))
                    .difficulty(in.difficulty() == null || in.difficulty().isBlank() ? "Basic" : in.difficulty())
                    .category(in.category() == null ? "" : in.category())
                    .tech(tech)
                    .build());
        }
        return questionRepository.saveAll(toSave);
    }

    /**
     * Bulk upsert: items whose id already exists are updated (only supplied fields),
     * everything else is inserted. All-or-nothing in one transaction.
     * Returns {created, updated}.
     */
    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "questionSearch", allEntries = true),
            @CacheEvict(value = "categories", allEntries = true),
            @CacheEvict(value = "stats", allEntries = true),
            @CacheEvict(value = "questionById", allEntries = true)
    })
    public java.util.Map<String, Integer> upsertFromInputs(List<com.interview.backend.dto.QuestionInput> inputs) {
        List<com.interview.backend.dto.QuestionInput> toCreate = new java.util.ArrayList<>();
        int updated = 0;
        for (com.interview.backend.dto.QuestionInput in : inputs) {
            String id = in.id() == null ? null : in.id().trim();
            if (id != null && !id.isEmpty() && questionRepository.existsById(id)) {
                update(id, in);
                updated++;
            } else {
                toCreate.add(in);
            }
        }
        int created = toCreate.isEmpty() ? 0 : createFromInputs(toCreate).size();
        return java.util.Map.of("created", created, "updated", updated);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "questionSearch", allEntries = true),
            @CacheEvict(value = "categories", allEntries = true),
            @CacheEvict(value = "stats", allEntries = true),
            @CacheEvict(value = "questionById", allEntries = true)
    })
    public Question update(String id, com.interview.backend.dto.QuestionInput in) {
        Question q = questionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + id));
        String before = contentOf(q);
        // Only overwrite fields the admin actually supplied.
        if (in.title() != null && !in.title().isBlank()) q.setTitle(in.title().trim());
        if (in.question() != null && !in.question().isBlank()) q.setQuestion(in.question());
        if (in.answer() != null && !in.answer().isBlank()) q.setAnswer(normalizeMarkdown(in.answer()));
        if (in.difficulty() != null && !in.difficulty().isBlank()) q.setDifficulty(in.difficulty());
        if (in.category() != null) q.setCategory(in.category());
        if (in.tech() != null && !in.tech().isBlank()) q.setTech(in.tech().trim().toLowerCase());
        // Saving without a real change must not bump updatedAt, or members get an "updated" email for nothing.
        if (contentOf(q).equals(before)) return q;
        return questionRepository.save(q);
    }

    public static String normalizeMarkdown(String text) {
        if (text == null) return null;
        return text.replaceAll("```[ \\t]+text[ \\t]*(\\r?\\n|$)", "```text$1");
    }

    private static String contentOf(Question q) {
        return String.join("\u0000", java.util.Objects.toString(q.getTitle(), ""), java.util.Objects.toString(q.getQuestion(), ""),
                java.util.Objects.toString(q.getAnswer(), ""), java.util.Objects.toString(q.getDifficulty(), ""),
                java.util.Objects.toString(q.getCategory(), ""), java.util.Objects.toString(q.getTech(), ""));
    }


    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "questionSearch", allEntries = true),
            @CacheEvict(value = "categories", allEntries = true),
            @CacheEvict(value = "stats", allEntries = true),
            @CacheEvict(value = "questionById", allEntries = true)
    })
    public void delete(String id) {
        if (!questionRepository.existsById(id))
            throw new IllegalArgumentException("Question not found: " + id);
        questionRepository.deleteById(id);
    }

    /** Rows for the public slug index: id, question, title, tech, updatedAt, createdAt. */
    public List<Object[]> indexRows() {
        return questionRepository.indexRows();
    }

    public java.util.Map<String, Long> getAllTechCounts() {
        java.util.List<String> techs = questionRepository.findDistinctTechs();
        java.util.Map<String, Long> counts = new java.util.HashMap<>();
        for (String tech : techs) {
            counts.put(tech, getCountByTech(tech));
        }
        return counts;
    }
}
