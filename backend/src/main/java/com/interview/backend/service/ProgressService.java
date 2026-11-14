package com.interview.backend.service;

import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.UserProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProgressService {

    private final UserProgressRepository repo;
    // Optional so the test context that doesn't load PointsService still works.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private PointsService points;

    private UserProgress row(Long userId, String questionId) {
        return repo.findByUserIdAndQuestionId(userId, questionId).orElseGet(() -> {
            UserProgress p = new UserProgress();
            p.setUserId(userId);
            p.setQuestionId(questionId);
            return p;
        });
    }

    /**
     * Find-or-create then change one row. Two requests for the same (user, question) can both find no row and both
     * insert; the second hits uq_user_question. Not one transaction on purpose: Postgres aborts a transaction after
     * that error, so the retry must run fresh, find the row the other request created, and apply the change to it.
     */
    private UserProgress change(Long userId, String questionId, java.util.function.Consumer<UserProgress> edit) {
        try {
            return save(userId, questionId, edit);
        } catch (org.springframework.dao.DataIntegrityViolationException raced) {
            return save(userId, questionId, edit);
        }
    }

    private UserProgress save(Long userId, String questionId, java.util.function.Consumer<UserProgress> edit) {
        UserProgress p = row(userId, questionId);
        edit.accept(p);
        return repo.save(p);
    }

    public void markVisited(Long userId, String questionId) {
        change(userId, questionId, p -> p.setVisited(true));
    }

    public void markRead(Long userId, String questionId) {
        change(userId, questionId, p -> {
            if (!p.isRead() || p.getReadAt() == null) p.setReadAt(java.time.Instant.now());
            p.setRead(true);
            p.setVisited(true); // reading implies visiting
        });
        if (points != null) points.touchStreak(userId);
    }

    public boolean toggleFlagged(Long userId, String questionId) {
        return change(userId, questionId, p -> p.setFlagged(!p.isFlagged())).isFlagged();
    }

    public boolean toggleImportant(Long userId, String questionId) {
        return change(userId, questionId, p -> p.setImportant(!p.isImportant())).isImportant();
    }

    // Merge guest ids from localStorage; never downgrades existing flags.
    // One read of the user's rows, then one batched save: no per-id query.
    public void merge(Long userId, Collection<String> visited, Collection<String> read) {
        try {
            doMerge(userId, visited, read);
        } catch (org.springframework.dao.DataIntegrityViolationException raced) {
            doMerge(userId, visited, read);   // a visit created one of these rows meanwhile; re-read and retry
        }
    }

    private void doMerge(Long userId, Collection<String> visited, Collection<String> read) {
        java.util.Set<String> v = visited == null ? java.util.Set.of() : new java.util.HashSet<>(visited);
        java.util.Set<String> r = read == null ? java.util.Set.of() : new java.util.HashSet<>(read);
        if (v.isEmpty() && r.isEmpty()) return;

        java.util.Map<String, UserProgress> byId = repo.findByUserId(userId).stream()
                .collect(java.util.stream.Collectors.toMap(UserProgress::getQuestionId, p -> p, (a, b) -> a));
        java.util.Set<String> ids = new java.util.HashSet<>(v);
        ids.addAll(r);

        List<UserProgress> toSave = new java.util.ArrayList<>();
        for (String id : ids) {
            UserProgress p = byId.get(id);
            if (p == null) {
                p = new UserProgress();
                p.setUserId(userId);
                p.setQuestionId(id);
            }
            if (r.contains(id)) { if (p.getReadAt() == null) p.setReadAt(java.time.Instant.now()); p.setRead(true); p.setVisited(true); }   // reading implies visiting
            else if (v.contains(id)) p.setVisited(true);
            toSave.add(p);
        }
        repo.saveAll(toSave);
    }
}
