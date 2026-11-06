package com.interview.backend.repository;

import com.interview.backend.entity.SiteNotice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteNoticeRepository extends JpaRepository<SiteNotice, Long> {}
