package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A request that ended in a 5xx response, kept so the admin can see what broke, where and for whom. */
@Entity
@Table(name = "server_errors", indexes = @Index(name = "idx_server_errors_created", columnList = "created_at"))
@Getter
@Setter
@NoArgsConstructor
public class ServerError {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(length = 10)
    private String method;
    @Column(length = 300)
    private String path;
    private int status;
    @Column(name = "exception_type", length = 160)
    private String exceptionType;
    @Column(length = 500)
    private String message;
    @Column(name = "user_email", length = 320)
    private String userEmail;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
