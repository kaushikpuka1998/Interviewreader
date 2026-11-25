package com.interview.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.Discussion;
import com.interview.backend.repository.DiscussionRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * On startup, adds the posts in discussion-seed.json (cited, imported compensation medians, built by
 * scripts/gen-india-comp-seed.py) to the discussions table, so the section is served from the database. Each is posted
 * anonymously. A post whose importKey is already stored is left alone, so restarts add nothing and later edits or hides by an
 * admin are kept. The rows belong to the first admin account, which lets an admin hide or delete them.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DiscussionSeed implements CommandLineRunner {

    private final DiscussionRepository discussions;
    private final UserRepository users;
    @Value("${app.admin.emails:}") private String adminEmails;

    @Override
    public void run(String... args) {
        List<Map<String, String>> items;
        try (InputStream in = new ClassPathResource("discussion-seed.json").getInputStream()) {
            items = new ObjectMapper().readValue(in, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("discussion-seed.json could not be read: {}", e.getMessage());
            return;
        }
        var keys = keys(items);
        var stored = new java.util.HashMap<String, Discussion>();
        for (var d : discussions.findByImportKeyIsNotNull()) stored.put(d.getImportKey(), d);
        hideRemoved(new java.util.HashSet<>(keys), stored);
        refresh(items, keys, stored);
        var todo = new ArrayList<Integer>();
        for (int k = 0; k < items.size(); k++) if (!stored.containsKey(keys.get(k))) todo.add(k);
        if (todo.isEmpty()) return;
        String first = adminEmails == null ? "" : adminEmails.split(",")[0].strip();
        var author = first.isEmpty() ? Optional.<com.interview.backend.entity.User>empty() : users.findByEmail(first);
        if (author.isEmpty()) { log.info("Discussion seed waits for the admin account to exist ({} posts pending)", todo.size()); return; }
        // Dated two weeks back, in file order, so members' own new posts stay above the imported ones in the newest-first feed.
        Instant base = Instant.now().minus(Duration.ofDays(14));
        int n = 0;
        var batch = new ArrayList<Discussion>();
        for (int k : todo) {
            var i = items.get(k);
            var d = new Discussion();
            d.setUserId(author.get().getId());
            d.setCategory(i.get("category"));
            d.setAnonymous(true);
            d.setImportKey(keys.get(k));
            d.setCompany(i.get("company"));
            d.setRole(blank(i.get("role")));
            d.setLevel(blank(i.get("level")));
            d.setCtc(i.get("ctc"));
            String yoe = i.get("yoe");
            if (yoe != null && !yoe.isBlank()) d.setYoe(Integer.valueOf(yoe));
            d.setTitle(i.get("title"));
            d.setBody(i.get("body"));
            d.setCreatedAt(base.minusSeconds(n++));
            batch.add(d);
        }
        discussions.saveAll(batch);
        log.info("Added {} imported discussion posts", n);
    }

    /**
     * An imported post that is no longer in the file (for example the per-level posts of an earlier version, now one post per company)
     * is hidden, not deleted, so any votes or comments on it are kept and an admin can still see it.
     */
    private void hideRemoved(java.util.Set<String> current, Map<String, Discussion> stored) {
        var gone = new ArrayList<Discussion>();
        for (var e : stored.entrySet()) {
            if (current.contains(e.getKey()) || !"active".equals(e.getValue().getStatus())) continue;
            e.getValue().setStatus("hidden");
            gone.add(e.getValue());
        }
        if (!gone.isEmpty()) {
            discussions.saveAll(gone);
            log.info("Hid {} imported discussion posts that are no longer in the seed file", gone.size());
        }
    }

    /**
     * An already stored imported post takes the file's current wording, so a corrected seed (for example a removed note) reaches
     * databases that loaded the earlier version. A post an admin edited (editedAt set) is left as the admin wrote it.
     */
    private void refresh(List<Map<String, String>> items, List<String> keys, Map<String, Discussion> stored) {
        var changed = new ArrayList<Discussion>();
        for (int k = 0; k < items.size(); k++) {
            var i = items.get(k);
            var d = stored.get(keys.get(k));
            if (d == null || d.getEditedAt() != null) continue;
            if (java.util.Objects.equals(d.getBody(), i.get("body")) && java.util.Objects.equals(d.getTitle(), i.get("title"))
                    && java.util.Objects.equals(d.getCtc(), i.get("ctc"))) continue;
            d.setTitle(i.get("title"));
            d.setBody(i.get("body"));
            d.setCtc(i.get("ctc"));
            d.setCompany(i.get("company"));
            d.setRole(blank(i.get("role")));
            d.setLevel(blank(i.get("level")));
            changed.add(d);
        }
        if (!changed.isEmpty()) {
            discussions.saveAll(changed);
            log.info("Refreshed {} imported discussion posts", changed.size());
        }
    }

    // The file carries no id per post: each post's key is made from its company name (one post per company), which is how a restart
    // knows it is already stored. Two companies with the same name slug are told apart by their order in the file.
    static final String KEY_PREFIX = "comp-in-company-";

    static List<String> keys(List<Map<String, String>> items) {
        var seen = new java.util.HashMap<String, Integer>();
        var out = new ArrayList<String>();
        for (var i : items) {
            String key = KEY_PREFIX + slug(i.get("company"));
            int n = seen.merge(key, 1, Integer::sum);
            if (n > 1) key += "-" + n;
            if (key.length() > 120) key = key.substring(0, 100) + "-" + md5(key).substring(0, 10);
            out.add(key);
        }
        return out;
    }

    private static String blank(String s) { return s == null || s.isBlank() ? null : s; }

    private static String slug(String s) { return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", ""); }

    private static String md5(String s) {
        try {
            var h = java.security.MessageDigest.getInstance("MD5").digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var b = new StringBuilder();
            for (byte x : h) b.append(String.format("%02x", x));
            return b.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
