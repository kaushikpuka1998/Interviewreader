package com.interview.backend.repository;

import com.interview.backend.entity.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionRepository extends JpaRepository<Question, String> {

    Optional<Question> findById(String id);

    long countByIdIn(List<String> ids);

    List<Question> findByTech(String tech);

    /** Interview question search: titles or question text containing the text, optionally limited to one tech. */
    @Query("select q from Question q where (:tech is null or q.tech = :tech) and (lower(q.title) like :p or lower(q.question) like :p or lower(q.id) like :p) order by q.tech, q.sortKey")
    List<Question> searchForInterview(@Param("tech") String tech, @Param("p") String pattern, org.springframework.data.domain.Pageable page);

    /** Questions published in a window — feeds the daily new-questions email. */
    /** Questions edited in the window that already existed before it (their creation isn't news). */
    List<Question> findByUpdatedAtGreaterThanEqualAndUpdatedAtLessThanAndCreatedAtLessThanOrderByTechAscSortKeyAsc(
            java.time.LocalDateTime from, java.time.LocalDateTime to, java.time.LocalDateTime createdBefore);

    List<Question> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByTechAscSortKeyAsc(
            java.time.LocalDateTime from, java.time.LocalDateTime to);

    List<Question> findByTechAndNumber(String tech, Integer number);

    Page<Question> findByTech(String tech, Pageable pageable);

    @Query("SELECT q FROM Question q WHERE " +
           // when :restrict is true only the allowed (free) techs are visible
           "(:restrict = false OR q.tech IN :allowedTechs) AND " +
           "(:tech IS NULL OR q.tech = :tech) AND " +
           "(:category IS NULL OR q.category = :category) AND " +
           "(:difficulty IS NULL OR q.difficulty = :difficulty) AND " +
           // :company is a Company.slug — questions readers reported as asked there
           "(:company IS NULL OR q.id IN (SELECT qc.questionId FROM QuestionCompany qc, Company c " +
           "                              WHERE c.id = qc.companyId AND c.slug = :company)) AND " +
           "(:search IS NULL OR LOWER(q.id) LIKE %:search% OR q.displayNumber = :searchNumber OR LOWER(q.title) LIKE %:search% OR LOWER(q.question) LIKE %:search% OR LOWER(q.answer) LIKE %:search% OR LOWER(q.category) LIKE %:search%) AND " +
           "(:status IS NULL OR " +
           "  (:status = 'visited' AND q.id IN :visitedIds) OR " +
           "  (:status = 'solved' AND q.id IN :readIds) OR " +
           "  (:status = 'flagged' AND q.id IN :flaggedIds) OR " +
           "  (:status = 'important' AND q.id IN :importantIds) OR " +
           "  (:status = 'unsolved' AND q.id NOT IN :readIds)" +
           ")")
    Page<Question> searchQuestions(
            @Param("restrict") boolean restrict,
            @Param("allowedTechs") List<String> allowedTechs,
            @Param("tech") String tech,
            @Param("category") String category,
            @Param("difficulty") String difficulty,
            @Param("company") String company,
            @Param("search") String search,
            @Param("searchNumber") Integer searchNumber,
            @Param("status") String status,
            @Param("visitedIds") List<String> visitedIds,
            @Param("readIds") List<String> readIds,
            @Param("flaggedIds") List<String> flaggedIds,
            @Param("importantIds") List<String> importantIds,
            Pageable pageable);

    @Query("SELECT DISTINCT q.category FROM Question q WHERE q.tech = :tech ORDER BY q.category")
    List<String> findCategoriesByTech(@Param("tech") String tech);

    @Query("SELECT COUNT(q) FROM Question q WHERE q.tech = :tech")
    long countByTech(@Param("tech") String tech);

    @Query("SELECT COUNT(q) FROM Question q")
    long countAll();

    @Query("SELECT COALESCE(MAX(q.number), 0) FROM Question q WHERE q.tech = :tech")
    int maxNumberByTech(@Param("tech") String tech);

    /**
     * Highest numeric suffix actually used by an id for this tech, e.g. "java-695" -> 695.
     *
     * Imported data has ids and `number` values that do not line up (java's MAX(number)
     * is 575 while ids run past 695), so a new id must be derived from the ids
     * themselves or it collides with an existing row.
     */
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM '[0-9]+$') AS INTEGER)), 0) " +
                   "FROM questions WHERE tech = :tech AND id ~ '-[0-9]+$'", nativeQuery = true)
    int maxIdSuffixByTech(@Param("tech") String tech);

    @Query("SELECT COALESCE(MAX(q.sortKey), 0) FROM Question q")
    int maxSortKey();

    @Query("SELECT DISTINCT q.tech FROM Question q ORDER BY q.tech")
    List<String> findDistinctTechs();

    /** id, question text, title, tech, updatedAt, createdAt for every question: the slug index (no answer text). */
    @Query("SELECT q.id, q.question, q.title, q.tech, q.updatedAt, q.createdAt FROM Question q ORDER BY q.tech, q.sortKey")
    List<Object[]> indexRows();

    /** Which of these ids still exist (one small query, no answer text). */
    @Query("SELECT q.id FROM Question q WHERE q.id IN :ids")
    List<String> existingIds(@Param("ids") java.util.Collection<String> ids);

    /** Question summaries for the given ids, without answers. */
    @Query("SELECT new com.interview.backend.dto.QuestionSummary(q.id, q.title, q.question, q.tech, q.difficulty, q.category) " +
           "FROM Question q WHERE q.id IN :ids ORDER BY q.sortKey")
    List<com.interview.backend.dto.QuestionSummary> summariesByIds(@Param("ids") java.util.Collection<String> ids);

    /** [id, tech, difficulty] for the given ids: for counting, without loading full questions. */
    @Query("SELECT q.id, q.tech, q.difficulty FROM Question q WHERE q.id IN :ids")
    List<Object[]> techDifficultyByIds(@Param("ids") java.util.Collection<String> ids);

    @Query("SELECT DISTINCT q.difficulty FROM Question q WHERE q.difficulty IS NOT NULL ORDER BY q.difficulty")
    List<String> findDistinctDifficulties();

    @Query("SELECT COUNT(q) FROM Question q WHERE q.difficulty = :difficulty")
    long countByDifficulty(@Param("difficulty") String difficulty);

    /** Question totals per tech in one query: row = [tech, count]. */
    @Query("SELECT q.tech, COUNT(q) FROM Question q GROUP BY q.tech")
    List<Object[]> countAllByTech();

    /** Question totals per difficulty in one query: row = [difficulty, count]. */
    @Query("SELECT q.difficulty, COUNT(q) FROM Question q WHERE q.difficulty IS NOT NULL GROUP BY q.difficulty")
    List<Object[]> countAllByDifficulty();

    /**
     * Stores a practice rubric without touching updated_at: a rubric isn't a content change, and bumping updated_at
     * would send members "updated question" digest emails and move the sitemap's lastmod.
     */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "UPDATE questions SET rubric = :rubric WHERE id = :id", nativeQuery = true)
    int updateRubric(@org.springframework.data.repository.query.Param("id") String id, @org.springframework.data.repository.query.Param("rubric") String rubric);

    /** Stores a voice interviewer bank, also without touching updated_at. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "UPDATE questions SET interview_bank = :bank WHERE id = :id", nativeQuery = true)
    int updateInterviewBank(@org.springframework.data.repository.query.Param("id") String id, @org.springframework.data.repository.query.Param("bank") String bank);
}
