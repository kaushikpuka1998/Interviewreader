package com.interview.backend.service;

import com.interview.backend.entity.Discussion;
import com.interview.backend.entity.User;
import com.interview.backend.repository.DiscussionRepository;
import com.interview.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class DiscussionSeedTest {

    private DiscussionSeed seed(DiscussionRepository repo, UserRepository users) {
        var s = new DiscussionSeed(repo, users);
        ReflectionTestUtils.setField(s, "adminEmails", "admin@example.com");
        return s;
    }

    @Test
    void importsEachPostOnceAndAnonymously() {
        var repo = mock(DiscussionRepository.class);
        var users = mock(UserRepository.class);
        var admin = new User(); admin.setId(7L);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        var old = new Discussion();
        old.setImportKey("comp-in-company-google");
        old.setTitle("Google | India | old");
        old.setBody("**Benefits and notes:** old wording");
        when(repo.findByImportKeyIsNotNull()).thenReturn(List.of(old));

        seed(repo, users).run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Discussion>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo, times(2)).saveAll(saved.capture());
        var posts = saved.getAllValues().get(1);
        // the stored post that has the old wording is refreshed, not duplicated
        assertEquals(1, saved.getAllValues().get(0).size());
        assertFalse(old.getBody().contains("Benefits and notes"));
        assertTrue(old.getTitle().startsWith("Google | India | ₹"));
        assertEquals(389, posts.size());   // one post per company, except the one already stored
        assertTrue(posts.stream().allMatch(d -> d.isAnonymous() && d.getUserId() == 7L && "compensation".equals(d.getCategory()) && d.getImportKey() != null));
        assertTrue(posts.stream().noneMatch(d -> "comp-in-company-google".equals(d.getImportKey())));
            }

    @Test
    void leavesAnAdminEditedPostAsTheAdminWroteIt() {
        var repo = mock(DiscussionRepository.class);
        var users = mock(UserRepository.class);
        var admin = new User(); admin.setId(7L);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        var edited = new Discussion();
        edited.setImportKey("comp-in-company-google");
        edited.setBody("my own wording");
        edited.setEditedAt(java.time.Instant.now());
        when(repo.findByImportKeyIsNotNull()).thenReturn(List.of(edited));
        seed(repo, users).run();
        assertEquals("my own wording", edited.getBody());
    }

    @Test
    void hidesPostsFromTheEarlierPerLevelVersionInsteadOfDeletingThem() {
        var repo = mock(DiscussionRepository.class);
        var users = mock(UserRepository.class);
        var admin = new User(); admin.setId(7L);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        var perLevel = new Discussion();
        perLevel.setImportKey("levelsfyi-in-2026-11-google-l4");
        perLevel.setStatus("active");
        when(repo.findByImportKeyIsNotNull()).thenReturn(List.of(perLevel));
        seed(repo, users).run();
        assertEquals("hidden", perLevel.getStatus());
        verify(repo, never()).delete(any(Discussion.class));
    }

    @Test
    void waitsWhenTheAdminAccountDoesNotExistYet() {
        var repo = mock(DiscussionRepository.class);
        var users = mock(UserRepository.class);
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());
        seed(repo, users).run();
        verify(repo, never()).saveAll(any());
    }
}
