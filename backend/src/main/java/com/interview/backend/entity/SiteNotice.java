package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** The optional text shown by the admin-controlled maintenance/service notice. */
@Entity
@Table(name = "site_notice")
@Getter
@Setter
@NoArgsConstructor
public class SiteNotice {

    @Id
    private Long id;

    @Column(length = 400)
    private String message;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
