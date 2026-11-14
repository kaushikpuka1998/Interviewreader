package com.interview.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.repository.ArchitectureSimulationRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/** Times of a member's solved system-design runs (every simulator check passed), for the activity heatmap. */
@Service
public class DesignActivity {

    private final ArchitectureSimulationRepository simulations;
    private final ObjectMapper json = new ObjectMapper();

    public DesignActivity(ArchitectureSimulationRepository simulations) {
        this.simulations = simulations;
    }

    public List<String> solvedTimes(Long userId) {
        return simulations.findTop500ByUserIdOrderByCreatedAtDesc(userId).stream().filter(s -> {
            try {
                Object tests = json.readValue(s.getResultJson(), new TypeReference<Map<String, Object>>() {}).get("tests");
                return tests instanceof List<?> l && !l.isEmpty()
                        && l.stream().allMatch(t -> t instanceof Map<?, ?> m && Boolean.TRUE.equals(m.get("passed")));
            } catch (Exception e) {
                return false;
            }
        }).map(s -> s.getCreatedAt().toString()).toList();
    }
}
