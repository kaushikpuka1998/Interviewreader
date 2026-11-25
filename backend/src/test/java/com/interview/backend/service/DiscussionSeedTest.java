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
        when(repo.importKeys()).thenReturn(Set.of("levelsfyi-in-2026-11-google-l4"));

        seed(repo, users).run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Discussion>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo).saveAll(saved.capture());
        var posts = saved.getValue();
        assertEquals(1104, posts.size());   // the whole file except the one already stored
        assertTrue(posts.stream().allMatch(d -> d.isAnonymous() && d.getUserId() == 7L && "compensation".equals(d.getCategory()) && d.getImportKey() != null));
        assertTrue(posts.stream().noneMatch(d -> "levelsfyi-in-2026-11-google-l4".equals(d.getImportKey())));
        assertTrue(posts.stream().anyMatch(d -> d.getYoe() != null));
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
