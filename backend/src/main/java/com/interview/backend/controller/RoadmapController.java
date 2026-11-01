package com.interview.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.interview.backend.service.BillingService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Company roadmaps (/api/roadmaps). Premium members get everything; everyone else gets a teaser:
 * company playbooks in full, but topics without their concepts, cheat sheets and practice links.
 */
@RestController
public class RoadmapController {

    private static final List<String> PREMIUM_FIELDS = List.of("concepts", "cheatSheet", "practiceProblems");

    private final BillingService billing;
    private final JsonNode full;
    private final JsonNode teaser;

    public RoadmapController(BillingService billing, ObjectMapper mapper) throws IOException {
        this.billing = billing;
        try (InputStream in = new ClassPathResource("roadmaps.json").getInputStream()) {
            this.full = mapper.readTree(in);
        }
        ObjectNode t = full.deepCopy();
        t.withArray("dsaPatterns").forEach(RoadmapController::strip);
        t.with("companyTopics").forEach(topics -> topics.forEach(RoadmapController::strip));
        this.teaser = t;
    }

    private static void strip(JsonNode topic) {
        ((ObjectNode) topic).remove(PREMIUM_FIELDS);
    }

    @GetMapping("/roadmaps")
    public JsonNode roadmaps() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean premium = auth != null && auth.isAuthenticated() && billing.isPremium(auth.getName());
        ObjectNode body = (premium ? full : teaser).deepCopy();
        body.put("premium", premium);
        body.put("signedIn", auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName()));
        body.put("priceLabel", billing.priceLabel());
        return body;
    }
}
