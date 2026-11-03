package com.interview.backend.controller;

import com.interview.backend.entity.Discussion;
import com.interview.backend.entity.DiscussionVote;
import com.interview.backend.entity.User;
import com.interview.backend.repository.DiscussionRepository;
import com.interview.backend.repository.DiscussionVoteRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * The /discussions feature: interview experiences, compensation reports, and general discussion.
 *
 * Reads are public — anyone can browse the first page, trending and a single post. Writes (post, vote, delete)
 * require sign-in; the SecurityConfig rules below enforce it. The frontend shows a soft "sign in to continue"
 * overlay after the first page so signed-out visitors can see the content and the quality before they commit.
 */
@RestController
@RequiredArgsConstructor
public class DiscussionController {

    private static final int MAX_BODY = 20000;
    private static final int MAX_PAGE = 20;

    private final DiscussionRepository discussions;
    private final DiscussionVoteRepository votes;
    private final UserRepository users;
    private final com.interview.backend.repository.DiscussionCommentRepository comments;

    // ---------- public reads ----------

    @GetMapping("/public/discussions")
    public Map<String, Object> list(@RequestParam(defaultValue = "new") String sort,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(required = false) String company,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "15") int size) {
        int p = Math.max(0, page);
        int s = Math.min(Math.max(1, size), MAX_PAGE);
        String cat = category == null || category.isBlank() || "all".equals(category) ? "" : category;
        String co = company == null || company.isBlank() ? "" : company.strip();
        var pageable = PageRequest.of(p, s);
        var out = "top".equals(sort) ? discussions.top(cat, co, pageable) : discussions.newest(cat, co, pageable);
        Long me = currentUserId();
        return Map.of(
                "items", out.getContent().stream().map(d -> toMap(d, me)).toList(),
                "page", p, "size", s, "total", out.getTotalElements(), "hasMore", !out.isLast());
    }

    @GetMapping("/public/discussions/trending")
    public List<Map<String, Object>> trending() {
        Long me = currentUserId();
        return discussions.trending(Instant.now().minus(7, ChronoUnit.DAYS), PageRequest.of(0, 5))
                .stream().map(d -> toMap(d, me)).toList();
    }

    @GetMapping("/public/discussions/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> detail(@PathVariable Long id) {
        return discussions.findById(id).filter(d -> "active".equals(d.getStatus())).map(d -> {
            d.setViews(d.getViews() + 1);
            discussions.save(d);
            return ResponseEntity.ok(toMap(d, currentUserId()));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ---------- authenticated writes ----------

    public record CreateReq(String category, Boolean anonymous, String company, String role, String level,
                            Integer yoe, String ctc, String title, String body) {}

    @PostMapping("/discussions")
    public ResponseEntity<?> create(@RequestBody CreateReq req) {
        User u = currentUser();
        if (req.title() == null || req.title().isBlank() || req.body() == null || req.body().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "A title and body are required."));
        String category = req.category() == null ? "general" : req.category().toLowerCase();
        if (!Set.of("experience", "compensation", "general").contains(category))
            return ResponseEntity.badRequest().body(Map.of("error", "Pick a valid category."));
        Discussion d = new Discussion();
        d.setUserId(u.getId());
        d.setCategory(category);
        d.setAnonymous(Boolean.TRUE.equals(req.anonymous()));
        d.setCompany(trim(req.company(), 120));
        d.setRole(trim(req.role(), 40));
        d.setLevel(trim(req.level(), 40));
        d.setYoe(req.yoe() == null ? null : Math.min(Math.max(req.yoe(), 0), 50));
        d.setCtc(trim(req.ctc(), 80));
        d.setTitle(trim(req.title(), 200));
        d.setBody(trim(req.body(), MAX_BODY));
        discussions.save(d);
        return ResponseEntity.ok(toMap(d, u.getId()));
    }

    /**
     * The author edits their own post. Only the content changes (title, body, category, company, role, level, years, pay): who posted it
     * and whether it is anonymous stay as they were, so editing can't unmask an anonymous post. Admins moderate with hide/delete, not edit.
     */
    @PutMapping("/discussions/{id}")
    @Transactional
    public ResponseEntity<?> edit(@PathVariable Long id, @RequestBody CreateReq req) {
        User u = currentUser();
        Discussion d = discussions.findById(id).filter(x -> "active".equals(x.getStatus())).orElse(null);
        if (d == null) return ResponseEntity.status(404).body(Map.of("error", "Not found"));
        if (!d.getUserId().equals(u.getId())) return ResponseEntity.status(403).body(Map.of("error", "This post is not yours."));
        if (req.title() == null || req.title().isBlank() || req.body() == null || req.body().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "A title and body are required."));
        String category = req.category() == null ? d.getCategory() : req.category().toLowerCase();
        if (!Set.of("experience", "compensation", "general").contains(category))
            return ResponseEntity.badRequest().body(Map.of("error", "Pick a valid category."));
        d.setCategory(category);
        d.setCompany(trim(req.company(), 120));
        d.setRole(trim(req.role(), 40));
        d.setLevel(trim(req.level(), 40));
        d.setYoe(req.yoe() == null ? null : Math.min(Math.max(req.yoe(), 0), 50));
        d.setCtc(trim(req.ctc(), 80));
        d.setTitle(trim(req.title(), 200));
        d.setBody(trim(req.body(), MAX_BODY));
        d.setEditedAt(Instant.now());
        discussions.save(d);
        return ResponseEntity.ok(toMap(d, u.getId()));
    }

    public record VoteReq(Integer value) {}

    @PostMapping("/discussions/{id}/vote")
    @Transactional
    public ResponseEntity<Map<String, Object>> vote(@PathVariable Long id, @RequestBody VoteReq req) {
        Long me = currentUserId();
        Discussion d = discussions.findById(id).filter(x -> "active".equals(x.getStatus())).orElse(null);
        if (d == null) return ResponseEntity.notFound().build();
        int want = req.value() == null ? 0 : Integer.signum(req.value());
        DiscussionVote v = votes.findByUserIdAndDiscussionId(me, id).orElseGet(() -> {
            DiscussionVote nv = new DiscussionVote(); nv.setUserId(me); nv.setDiscussionId(id); return nv;
        });
        int prev = v.getValue();
        if (prev == want) return ResponseEntity.ok(toMap(d, me));
        if (prev > 0) d.setUpvotes(Math.max(0, d.getUpvotes() - 1));
        if (prev < 0) d.setDownvotes(Math.max(0, d.getDownvotes() - 1));
        if (want > 0) d.setUpvotes(d.getUpvotes() + 1);
        if (want < 0) d.setDownvotes(d.getDownvotes() + 1);
        v.setValue(want);
        votes.save(v);
        d.setScore(d.getUpvotes() - d.getDownvotes());
        discussions.save(d);
        return ResponseEntity.ok(toMap(d, me));
    }

    @DeleteMapping("/discussions/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        User u = currentUser();
        return discussions.findById(id).map(d -> {
            if (!d.getUserId().equals(u.getId()) && !isAdmin())
                return ResponseEntity.status(403).body(Map.of("error", "This post is not yours."));
            d.setStatus("hidden");
            discussions.save(d);
            return ResponseEntity.ok(Map.of("ok", true));
        }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Not found")));
    }

    // ---------- comments ----------

    @GetMapping("/public/discussions/{id}/comments")
    public List<Map<String, Object>> comments(@PathVariable Long id) {
        Long me = currentUserId();
        return comments.findByDiscussionIdAndStatusOrderByCreatedAtAsc(id, "active").stream().map(c -> commentMap(c, me)).toList();
    }

    public record CommentReq(String body, Long parentId, Boolean anonymous) {}

    @PostMapping("/discussions/{id}/comments")
    @Transactional
    public ResponseEntity<?> addComment(@PathVariable Long id, @RequestBody CommentReq req) {
        User u = currentUser();
        Discussion d = discussions.findById(id).filter(x -> "active".equals(x.getStatus())).orElse(null);
        if (d == null) return ResponseEntity.notFound().build();
        String body = trim(req.body(), 5000);
        if (body == null) return ResponseEntity.badRequest().body(Map.of("error", "Write something first."));
        if (req.parentId() != null && comments.findById(req.parentId()).filter(p -> p.getDiscussionId().equals(id)).isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "That comment is gone."));
        var c = new com.interview.backend.entity.DiscussionComment();
        c.setDiscussionId(id); c.setParentId(req.parentId()); c.setUserId(u.getId()); c.setBody(body);
        c.setAnonymous(Boolean.TRUE.equals(req.anonymous()));
        comments.save(c);
        d.setCommentCount((int) comments.countByDiscussionIdAndStatus(id, "active"));
        discussions.save(d);
        return ResponseEntity.ok(commentMap(c, u.getId()));
    }

    public record EditCommentReq(String body) {}

    /** The author edits their own comment (anonymity and parent stay as they were). */
    @PutMapping("/discussions/{id}/comments/{cid}")
    @Transactional
    public ResponseEntity<?> editComment(@PathVariable Long id, @PathVariable Long cid, @RequestBody EditCommentReq req) {
        User u = currentUser();
        var c = comments.findById(cid).filter(x -> x.getDiscussionId().equals(id) && "active".equals(x.getStatus())).orElse(null);
        if (c == null) return ResponseEntity.status(404).body(Map.of("error", "Not found"));
        if (!c.getUserId().equals(u.getId())) return ResponseEntity.status(403).body(Map.of("error", "This comment is not yours."));
        String body = trim(req.body(), 5000);
        if (body == null) return ResponseEntity.badRequest().body(Map.of("error", "Write something first."));
        c.setBody(body);
        c.setEditedAt(Instant.now());
        comments.save(c);
        return ResponseEntity.ok(commentMap(c, u.getId()));
    }

    @DeleteMapping("/discussions/{id}/comments/{cid}")
    @Transactional
    public ResponseEntity<?> deleteComment(@PathVariable Long id, @PathVariable Long cid) {
        User u = currentUser();
        return comments.findById(cid).filter(c -> c.getDiscussionId().equals(id)).map(c -> {
            if (!c.getUserId().equals(u.getId()) && !isAdmin()) return ResponseEntity.status(403).body((Object) Map.of("error", "This comment is not yours."));
            c.setStatus("hidden");
            comments.save(c);
            recount(id);
            return ResponseEntity.ok((Object) Map.of("ok", true));
        }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Not found")));
    }

    // ---------- admin moderation (under /admin/**, ROLE_ADMIN) ----------

    /**
     * Search and page through every post (hidden included) with the author's real email, even for anonymous posts.
     * Built for a big table: filtered and sorted in SQL, 25 per page, with a total so the page can show "page 3 of 40,000".
     */
    @GetMapping("/admin/discussions")
    public Map<String, Object> adminList(@RequestParam(defaultValue = "") String status, @RequestParam(defaultValue = "") String category,
                                         @RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "new") String sort,
                                         @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        String like = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        var res = discussions.adminSearch(status, category, like, Set.of("score", "comments").contains(sort) ? sort : "new",
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100)));
        // One query for the page's authors, not one per row.
        var emails = new HashMap<Long, String>();
        users.findAllById(res.getContent().stream().map(Discussion::getUserId).collect(java.util.stream.Collectors.toSet()))
                .forEach(u -> emails.put(u.getId(), u.getEmail()));
        var items = res.getContent().stream().map(d -> {
            var m = toMap(d, null);
            m.put("status", d.getStatus());
            m.put("authorEmail", emails.getOrDefault(d.getUserId(), ""));
            m.put("anonymous", d.isAnonymous());
            return m;
        }).toList();
        return Map.of("items", items, "page", res.getNumber(), "size", res.getSize(), "total", res.getTotalElements(), "totalPages", res.getTotalPages());
    }

    /** Hide every live post by one member (matched by email), e.g. a spammer. */
    @PostMapping("/admin/discussions/author/hide")
    public ResponseEntity<?> hideAuthor(@RequestBody Map<String, String> body) {
        return users.findByEmail(String.valueOf(body.getOrDefault("email", "")).strip().toLowerCase())
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(Map.of("hidden", discussions.hideAllByUser(u.getId()))))
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "No member with that email.")));
    }

    @PostMapping("/admin/discussions/{id}/{action}")
    @Transactional
    public ResponseEntity<?> adminAct(@PathVariable Long id, @PathVariable String action) {
        return discussions.findById(id).map(d -> {
            switch (action) {
                case "hide" -> { d.setStatus("hidden"); discussions.save(d); }
                case "show" -> { d.setStatus("active"); discussions.save(d); }
                case "delete" -> { comments.deleteByDiscussionId(id); votes.deleteByDiscussionId(id); discussions.delete(d); }
                default -> { return ResponseEntity.badRequest().body((Object) Map.of("error", "Unknown action")); }
            }
            return ResponseEntity.ok((Object) Map.of("ok", true));
        }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Not found")));
    }

    /** Comments on one post, hidden ones included, with real authors, for the admin to hide or restore. */
    @GetMapping("/admin/discussions/{id}/comments")
    public List<Map<String, Object>> adminComments(@PathVariable Long id) {
        return comments.findByDiscussionIdOrderByCreatedAtAsc(id).stream().map(c -> {
            var m = commentMap(c, null);
            m.put("status", c.getStatus());
            m.put("authorEmail", users.findById(c.getUserId()).map(User::getEmail).orElse(""));
            return m;
        }).toList();
    }

    @PostMapping("/admin/discussion-comments/{cid}/{action}")
    @Transactional
    public ResponseEntity<?> adminCommentAct(@PathVariable Long cid, @PathVariable String action) {
        return comments.findById(cid).map(c -> {
            if (!Set.of("hide", "show").contains(action)) return ResponseEntity.badRequest().body((Object) Map.of("error", "Unknown action"));
            c.setStatus("hide".equals(action) ? "hidden" : "active");
            comments.save(c);
            recount(c.getDiscussionId());
            return ResponseEntity.ok((Object) Map.of("ok", true));
        }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Not found")));
    }

    private void recount(Long discussionId) {
        discussions.findById(discussionId).ifPresent(d -> { d.setCommentCount((int) comments.countByDiscussionIdAndStatus(discussionId, "active")); discussions.save(d); });
    }

    private Map<String, Object> commentMap(com.interview.backend.entity.DiscussionComment c, Long me) {
        var m = new LinkedHashMap<String, Object>();
        m.put("id", c.getId());
        m.put("parentId", c.getParentId());
        m.put("body", c.getBody());
        m.put("createdAt", c.getCreatedAt());
        m.put("editedAt", c.getEditedAt());
        m.put("anonymous", c.isAnonymous());
        if (c.isAnonymous()) m.put("author", Map.of("name", "Anonymous", "anonymous", true));
        else users.findById(c.getUserId()).ifPresent(u -> m.put("author", Map.of(
                "name", u.getName() == null || u.getName().isBlank() ? (u.getUsername() == null ? "Member" : u.getUsername()) : u.getName(),
                "username", u.getUsername() == null ? "" : u.getUsername(), "anonymous", false)));
        m.put("mine", me != null && me.equals(c.getUserId()));
        return m;
    }

    // ---------- helpers ----------

    private Map<String, Object> toMap(Discussion d, Long me) {
        var m = new LinkedHashMap<String, Object>();
        m.put("id", d.getId());
        m.put("category", d.getCategory());
        m.put("company", d.getCompany());
        m.put("role", d.getRole());
        m.put("level", d.getLevel());
        m.put("yoe", d.getYoe());
        m.put("ctc", d.getCtc());
        m.put("title", d.getTitle());
        m.put("body", d.getBody());
        m.put("upvotes", d.getUpvotes());
        m.put("downvotes", d.getDownvotes());
        m.put("score", d.getScore());
        m.put("views", d.getViews());
        m.put("commentCount", d.getCommentCount());
        m.put("createdAt", d.getCreatedAt());
        m.put("editedAt", d.getEditedAt());
        // Author: hidden when anonymous. Still send the row's id so an admin page can tie it back if needed.
        if (d.isAnonymous()) {
            m.put("author", Map.of("name", "Anonymous", "anonymous", true));
        } else {
            users.findById(d.getUserId()).ifPresent(u -> m.put("author", Map.of(
                    "name", u.getName() == null || u.getName().isBlank() ? (u.getUsername() == null ? "Member" : u.getUsername()) : u.getName(),
                    "username", u.getUsername() == null ? "" : u.getUsername(),
                    "anonymous", false)));
        }
        m.put("myVote", me == null ? 0 : votes.findByUserIdAndDiscussionId(me, d.getId()).map(DiscussionVote::getValue).orElse(0));
        m.put("mine", me != null && me.equals(d.getUserId()));
        return m;
    }

    private String trim(String s, int max) {
        if (s == null) return null;
        String t = s.strip();
        return t.isEmpty() ? null : t.length() > max ? t.substring(0, max) : t;
    }

    private Long currentUserId() {
        var a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getName())) return null;
        return users.findByEmail(a.getName()).map(User::getId).orElse(null);
    }

    private User currentUser() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
    }

    private boolean isAdmin() {
        var a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream().anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()));
    }
}
