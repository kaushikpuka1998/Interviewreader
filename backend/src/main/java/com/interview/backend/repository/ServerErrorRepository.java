package com.interview.backend.repository;

import com.interview.backend.entity.ServerError;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ServerErrorRepository extends JpaRepository<ServerError, Long> {
    List<ServerError> findTop200ByCreatedAtAfterOrderByCreatedAtDesc(Instant since);
    long countByCreatedAtAfter(Instant since);
}
