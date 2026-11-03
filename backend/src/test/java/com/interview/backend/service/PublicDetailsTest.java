package com.interview.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PublicDetailsTest {

    @Test
    void handlesAreReducedToTheBareName() {
        assertEquals("octocat", PublicDetails.github("https://github.com/octocat/"));
        assertEquals("octocat", PublicDetails.github("@octocat"));
        assertEquals("octocat", PublicDetails.github("github.com/octocat?tab=repos"));
        assertEquals("jane-doe-1a2b", PublicDetails.linkedin("https://www.linkedin.com/in/jane-doe-1a2b/"));
        assertEquals("jane-doe", PublicDetails.linkedin("jane-doe"));
        assertNull(PublicDetails.github("  "));
    }

    @Test
    void badHandlesAreRefused() {
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.github("bad name"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.github("-leading"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.linkedin("ab"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.linkedin("<script>"));
    }

    @Test
    void websiteMustBePlainHttp() {
        assertEquals("https://example.com/me", PublicDetails.website("example.com/me"));
        assertEquals("http://example.org", PublicDetails.website("http://example.org"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.website("javascript:alert(1)"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.website("ftp://example.com"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.website("https://user:pass@example.com"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.website("https://localhost"));
    }

    @Test
    void textIsTidiedAndLimited() {
        assertEquals("Software Engineer at Acme", PublicDetails.text("  Software\n Engineer   at \tAcme ", 120, "Headline"));
        assertNull(PublicDetails.text("   ", 120, "Headline"));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.text("x".repeat(121), 120, "Headline"));
    }

    @Test
    void skillsAreDedupedAndCapped() {
        assertEquals(List.of("Java", "C++", "Node.js"), PublicDetails.skills(List.of("Java", " java ", "C++", "", "Node.js")));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.skills(List.of("a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8", "i9")));
        assertThrows(IllegalArgumentException.class, () -> PublicDetails.skills(List.of("<b>x</b>")));
    }

    @Test
    void viewHidesEmptyFields() {
        assertNull(PublicDetails.view(null, "", null, null, null, null, null));
        var v = PublicDetails.view("Dev", null, "octocat", null, null, null, "Java,Go");
        assertEquals(List.of("Java", "Go"), v.get("skills"));
        assertFalse(v.containsKey("college"));
    }
}
