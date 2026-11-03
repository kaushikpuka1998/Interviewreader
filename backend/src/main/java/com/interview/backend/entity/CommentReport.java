package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "comment_reports", uniqueConstraints = @UniqueConstraint(name = "uq_comment_report", columnNames = {"comment_id", "user_id"}))
@Getter @Setter @NoArgsConstructor
public class CommentReport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "comment_id", nullable = false)
    private Long commentId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
}
