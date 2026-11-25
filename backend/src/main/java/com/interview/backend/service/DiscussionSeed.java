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
        var have = discussions.importKeys();
        var todo = items.stream().filter(i -> !have.contains(i.get("importKey"))).toList();
        if (todo.isEmpty()) return;
        String first = adminEmails == null ? "" : adminEmails.split(",")[0].strip();
        var author = first.isEmpty() ? Optional.<com.interview.backend.entity.User>empty() : users.findByEmail(first);
        if (author.isEmpty()) { log.info("Discussion seed waits for the admin account to exist ({} posts pending)", todo.size()); return; }
        // Dated two weeks back, in file order, so members' own new posts stay above the imported ones in the newest-first feed.
        Instant base = Instant.now().minus(Duration.ofDays(14));
        int n = 0;
        var batch = new ArrayList<Discussion>();
        for (var i : todo) {
            var d = new Discussion();
            d.setUserId(author.get().getId());
            d.setCategory(i.get("category"));
            d.setAnonymous(true);
            d.setImportKey(i.get("importKey"));
            d.setCompany(i.get("company"));
            d.setRole(i.get("role"));
            d.setLevel(i.get("level"));
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
}
