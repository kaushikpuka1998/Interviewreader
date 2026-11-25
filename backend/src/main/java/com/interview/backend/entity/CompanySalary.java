package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One pay level at one company (India): the median total yearly pay reported for that level. Reference data loaded by SalarySeed from
 * company-salaries.json, shown on the Salaries pages; it is not a member's post.
 */
@Entity
@Table(name = "company_salaries", indexes = @Index(name = "idx_salary_company", columnList = "company_slug"))
@Getter
@Setter
@NoArgsConstructor
public class CompanySalary {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** company slug + level slug (+ order for a repeat): tells SalarySeed which row a line of the file is. */
    @Column(name = "row_key", nullable = false, unique = true, length = 200)
    private String rowKey;

    @Column(nullable = false, length = 120)
    private String company;

    @Column(name = "company_slug", nullable = false, length = 120)
    private String companySlug;

    @Column(length = 60)
    private String segment;

    /** The company's own level name (L4, SDE 2, Senior Engineer), or "All levels" when the source has no breakdown. */
    @Column(nullable = false, length = 60)
    private String level;

    /** The level in common terms (SDE-1 / Entry, SDE-2, SDE-3 / Senior, Staff / Principal+); empty for "All levels". */
    @Column(length = 40)
    private String norm;

    @Column(length = 30)
    private String yoe;

    /** Median total pay per year in rupees. */
    @Column(nullable = false)
    private long inr;

    /** The same in lakhs per year as shown (22.1). */
    @Column(nullable = false, length = 12)
    private String lpa;

    /** The company's median across its levels in LPA, when the source gives it. */
    @Column(name = "company_median", length = 12)
    private String companyMedian;
}
