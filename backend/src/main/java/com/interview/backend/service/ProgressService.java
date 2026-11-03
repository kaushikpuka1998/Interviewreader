package com.interview.backend.service;

import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.UserProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public void markVisited(Long userId, String questionId) {
        UserProgress p = row(userId, questionId);
        p.setVisited(true);
        repo.save(p);
    }

    @Transactional
    public void markRead(Long userId, String questionId) {
        UserProgress p = row(userId, questionId);
        if (!p.isRead() || p.getReadAt() == null) p.setReadAt(java.time.Instant.now());
        p.setRead(true);
        p.setVisited(true); // reading implies visiting
        repo.save(p);
        if (points != null) points.touchStreak(userId);
    }

    @Transactional
    public boolean toggleFlagged(Long userId, String questionId) {
        UserProgress p = row(userId, questionId);
        p.setFlagged(!p.isFlagged());
        repo.save(p);
        return p.isFlagged();
    }

    @Transactional
    public boolean toggleImportant(Long userId, String questionId) {
        UserProgress p = row(userId, questionId);
        p.setImportant(!p.isImportant());
        repo.save(p);
        return p.isImportant();
    }

    // Merge guest ids from localStorage; never downgrades existing flags.
    // One read of the user's rows, then one batched save: no per-id query.
    @Transactional
    public void merge(Long userId, Collection<String> visited, Collection<String> read) {
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
