package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One successful architecture simulation, used for the free-run quota and to restore the member's latest design. */
@Entity
@Table(name = "architecture_simulations", indexes = {
        @Index(name = "idx_architecture_simulations_user", columnList = "user_id, created_at")
})
@Getter
@Setter
@NoArgsConstructor
public class ArchitectureSimulation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "question_id", nullable = false, length = 100)
    private String questionId;

    @Column(name = "target_rps")
    private Long targetRps;

    @Column(name = "nodes_json", columnDefinition = "TEXT")
    private String nodesJson;

    @Column(name = "edges_json", columnDefinition = "TEXT")
    private String edgesJson;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
