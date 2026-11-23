package com.interview.backend.controller;

import com.interview.backend.entity.MockInterview;
import com.interview.backend.entity.User;
import com.interview.backend.repository.*;
import com.interview.backend.service.EmailService;
import com.interview.backend.service.ImageService;
import com.interview.backend.service.InterviewAccessService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Peer mock interviews: requesting, the 402 when out of interviews, matching rules, feedback, finishing and cancelling. */
class MockInterviewControllerTest {

    private MockInterviewRepository interviews;
    private UserRepository users;
    private ResumeRepository resumes;
    private FeatureFlagRepository flags;
    private EmailService email;
    private InterviewAccessService access;
    private MockInterviewController controller;
    private User me;

    @BeforeEach
    void setUp() {
        interviews = mock(MockInterviewRepository.class);
        users = mock(UserRepository.class);
        resumes = mock(ResumeRepository.class);
        flags = mock(FeatureFlagRepository.class);
        email = mock(EmailService.class);
        access = mock(InterviewAccessService.class);
        controller = new MockInterviewController(interviews, users, resumes, mock(QuestionRepository.class), mock(CodingProblemRepository.class),
                email, flags, mock(ImageService.class), access);
        me = new User();
        me.setId(1L);
        me.setEmail("me@example.com");
        when(users.findByEmail("me@example.com")).thenReturn(Optional.of(me));
        when(interviews.save(any())).thenAnswer(i -> i.getArgument(0));
        when(interviews.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(any(), any())).thenReturn(new ArrayList<>());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("me@example.com", "x", List.of()));
    }

    @AfterEach
    void tearDown() { SecurityContextHolder.clearContext(); }

    private static String in(Duration d) { return Instant.now().plus(d).toString(); }

    private static String error(ResponseEntity<?> r) { return (String) ((Map<?, ?>) r.getBody()).get("error"); }

    private MockInterviewController.RequestInput request(String type, String slot) {
        return new MockInterviewController.RequestInput(type, null, slot, false);
    }

    private static MockInterview interview(Long id, String status, Long candidate, Long interviewer) {
        MockInterview m = new MockInterview();
        m.setId(id);
        m.setStatus(status);
        m.setCandidateId(candidate);
        m.setInterviewerId(interviewer);
        return m;
    }

    // ---- request ----

    @Test
    void requestNeedsAKnownTypeAndAValidTime() {
        assertEquals(400, controller.request(request(null, in(Duration.ofDays(1)))).getStatusCode().value());
        assertEquals(400, controller.request(request("BOGUS", in(Duration.ofDays(1)))).getStatusCode().value());
        assertEquals(400, controller.request(request(MockInterview.CODING, null)).getStatusCode().value());
        assertEquals(400, controller.request(request(MockInterview.CODING, "tomorrow")).getStatusCode().value());
        assertTrue(error(controller.request(request(MockInterview.CODING, in(Duration.ofMinutes(5))))).contains("10 minutes"));
        assertTrue(error(controller.request(request(MockInterview.CODING, in(Duration.ofDays(45))))).contains("30 days"));
        verify(interviews, never()).save(any());
    }

    @Test
    void aResumeInterviewNeedsAResumeThatIsTheMembers() {
        assertTrue(error(controller.request(request(MockInterview.RESUME, in(Duration.ofDays(1))))).contains("resume"));
        when(resumes.findByIdAndUserId(9L, 1L)).thenReturn(Optional.empty());
        var withOthersResume = new MockInterviewController.RequestInput(MockInterview.RESUME, 9L, in(Duration.ofDays(1)), false);
        assertTrue(error(controller.request(withOthersResume)).contains("not yours"));
    }

    @Test
    void requestingChargesTheAllowanceAndSavesAWaitingInterview() {
        when(access.charge(me)).thenReturn(InterviewAccessService.PREMIUM);
        ResponseEntity<?> r = controller.request(request(MockInterview.CODING, in(Duration.ofDays(2))));
        assertEquals(200, r.getStatusCode().value());
        verify(interviews).save(argThat(m -> InterviewAccessService.PREMIUM.equals(m.getBilledAs())
                && MockInterview.CODING.equals(m.getType()) && m.getCandidateId().equals(1L) && MockInterview.WAITING.equals(m.getStatus())));
    }

    @Test
    void outOfInterviewsIs402WithTheQuota() {
        when(access.charge(me)).thenThrow(new InterviewAccessService.OutOfInterviews());
        when(access.quota(me)).thenReturn(Map.of("canRequest", false));
        ResponseEntity<?> r = controller.request(request(MockInterview.CODING, in(Duration.ofDays(2))));
        assertEquals(402, r.getStatusCode().value());
        assertNotNull(((Map<?, ?>) r.getBody()).get("quota"));
        verify(interviews, never()).save(any());
    }

    @Test
    void twoInterviewsWithinAnHourAreRefused() {
        MockInterview existing = interview(5L, MockInterview.WAITING, 1L, null);
        existing.setSlotAt(Instant.now().plus(Duration.ofDays(2)));
        when(interviews.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(any(), any())).thenReturn(List.of(existing));
        String near = Instant.now().plus(Duration.ofDays(2)).plusSeconds(20 * 60).toString();
        assertTrue(error(controller.request(request(MockInterview.CODING, near))).contains("within an hour"));
        verify(access, never()).charge(any());
    }

    @Test
    void atMostFiveInterviewsCanBeOpenAtOnce() {
        List<MockInterview> open = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            MockInterview m = interview((long) i, MockInterview.WAITING, 1L, null);
            m.setSlotAt(Instant.now().plus(Duration.ofDays(i + 3)));
            open.add(m);
        }
        when(interviews.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(any(), any())).thenReturn(open);
        assertTrue(error(controller.request(request(MockInterview.CODING, in(Duration.ofDays(20))))).contains("at most 5"));
    }

    // ---- interviewer side ----

    @Test
    void membersCannotInterviewWhileTheFlagIsOff() {
        when(flags.findById("interviewer_open")).thenReturn(Optional.empty());
        assertEquals(403, controller.accept(new MockInterviewController.AcceptInput(MockInterview.CODING)).getStatusCode().value());
        assertEquals(403, controller.take(3L).getStatusCode().value());
        assertEquals(403, controller.upcoming().getStatusCode().value());
    }

    @Test
    void anInterviewerCannotTakeTheirOwnRequestOrOneThatIsGone() {
        var flag = mock(com.interview.backend.entity.FeatureFlag.class);
        when(flag.isEnabled()).thenReturn(true);
        when(flags.findById("interviewer_open")).thenReturn(Optional.of(flag));
        when(interviews.findById(3L)).thenReturn(Optional.of(interview(3L, MockInterview.WAITING, 1L, null)));
        assertTrue(error(controller.take(3L)).contains("yourself"));
        when(interviews.findById(4L)).thenReturn(Optional.of(interview(4L, MockInterview.MATCHED, 2L, 8L)));
        assertTrue(error(controller.take(4L)).contains("no longer waiting"));
        when(interviews.findById(5L)).thenReturn(Optional.empty());
        assertEquals(400, controller.take(5L).getStatusCode().value());
    }

    @Test
    void acceptWithNobodyWaitingIs404() {
        var flag = mock(com.interview.backend.entity.FeatureFlag.class);
        when(flag.isEnabled()).thenReturn(true);
        when(flags.findById("interviewer_open")).thenReturn(Optional.of(flag));
        when(interviews.findByStatusAndTypeAndCandidateIdNot(any(), any(), any())).thenReturn(List.of());
        assertEquals(404, controller.accept(new MockInterviewController.AcceptInput(MockInterview.CODING)).getStatusCode().value());
        assertEquals(400, controller.accept(new MockInterviewController.AcceptInput("BOGUS")).getStatusCode().value());
    }

    // ---- feedback ----

    @Test
    void onlyTheInterviewerCanGiveFeedbackAndItNeedsARatingAndText() {
        MockInterview m = interview(7L, MockInterview.DONE, 2L, 1L);
        when(interviews.findById(7L)).thenReturn(Optional.of(m));
        assertEquals(400, controller.feedback(7L, new MockInterviewController.FeedbackInput(0, "good", "")).getStatusCode().value());
        assertEquals(400, controller.feedback(7L, new MockInterviewController.FeedbackInput(6, "good", "")).getStatusCode().value());
        assertEquals(400, controller.feedback(7L, new MockInterviewController.FeedbackInput(4, " ", "")).getStatusCode().value());
        MockInterview notMine = interview(8L, MockInterview.DONE, 2L, 99L);
        when(interviews.findById(8L)).thenReturn(Optional.of(notMine));
        assertEquals(404, controller.feedback(8L, new MockInterviewController.FeedbackInput(4, "good", "")).getStatusCode().value());
    }

    @Test
    void feedbackIsSavedAndTheCandidateIsEmailedOnlyTheFirstTime() {
        MockInterview m = interview(7L, MockInterview.DONE, 2L, 1L);
        User candidate = new User();
        candidate.setEmail("cand@example.com");
        when(interviews.findById(7L)).thenReturn(Optional.of(m));
        when(users.findById(2L)).thenReturn(Optional.of(candidate));
        assertEquals(200, controller.feedback(7L, new MockInterviewController.FeedbackInput(4, "clear thinking", "more tests")).getStatusCode().value());
        assertEquals(4, m.getFeedbackRating());
        verify(email, times(1)).sendAnnouncement(eq("cand@example.com"), any(), any());
        controller.feedback(7L, new MockInterviewController.FeedbackInput(5, "edited", ""));
        verify(email, times(1)).sendAnnouncement(any(), any(), any());
    }

    // ---- finishing and cancelling ----

    @Test
    void aParticipantCanCancelAndAStrangerCannot() {
        MockInterview m = interview(7L, MockInterview.WAITING, 1L, null);
        when(interviews.findById(7L)).thenReturn(Optional.of(m));
        assertEquals(200, controller.cancel(7L).getStatusCode().value());
        assertEquals(MockInterview.CANCELLED, m.getStatus());
        MockInterview other = interview(8L, MockInterview.WAITING, 2L, 3L);
        when(interviews.findById(8L)).thenReturn(Optional.of(other));
        assertEquals(404, controller.cancel(8L).getStatusCode().value());
        assertEquals(MockInterview.WAITING, other.getStatus());
    }

    @Test
    void aFinishedInterviewStaysFinished() {
        MockInterview m = interview(7L, MockInterview.DONE, 1L, 2L);
        when(interviews.findById(7L)).thenReturn(Optional.of(m));
        controller.cancel(7L);
        assertEquals(MockInterview.DONE, m.getStatus());
        verify(interviews, never()).save(any());
    }

    @Test
    void completeNeedsAllQuestionsDoneOrAnHourAfterTheStart() {
        MockInterview m = interview(7L, MockInterview.MATCHED, 1L, 2L);
        m.setSlotAt(Instant.now().plus(Duration.ofHours(1)));
        when(interviews.findById(7L)).thenReturn(Optional.of(m));
        assertEquals(400, controller.complete(7L).getStatusCode().value());
        assertEquals(MockInterview.MATCHED, m.getStatus());
        m.setSlotAt(Instant.now().minus(Duration.ofHours(2)));
        assertEquals(200, controller.complete(7L).getStatusCode().value());
        assertEquals(MockInterview.DONE, m.getStatus());
    }
}
