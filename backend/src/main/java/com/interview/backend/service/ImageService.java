package com.interview.backend.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@Service
@Slf4j
public class ImageService {

    private static final Set<String> ALLOWED = Set.of(
            "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml");
    private static final long MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    private final S3Client s3;
    private final String bucket;
    private final String publicBaseUrl;
    private final int maxStoredBytes;

    public ImageService(S3Client s3,
                        @Value("${app.s3.bucket}") String bucket,
                        @Value("${app.public-base-url}") String publicBaseUrl,
                        @Value("${app.image.max-stored-kb:200}") int maxStoredKb) {
        this.maxStoredBytes = maxStoredKb * 1024;
        this.s3 = s3;
        this.bucket = bucket;
        // The backend's own public origin (no trailing slash). Images are served back
        // through /api/images/file/** so the bucket can stay private.
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    // Ensure the bucket exists (LocalStack starts empty; managed buckets already exist).
    @PostConstruct
    void ensureBucket() {
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (S3Exception e) { // covers NoSuchBucketException (a subclass) and 404s
            try {
                s3.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                log.info("Created S3 bucket '{}'", bucket);
            } catch (BucketAlreadyOwnedByYouException | BucketAlreadyExistsException ignored) {
            } catch (Exception ex) {
                log.warn("Could not create bucket '{}': {}", bucket, ex.getMessage());
            }
        }
    }

    // Uploads the image (bucket stays private) and returns a proxied URL served by this app.
    public String upload(MultipartFile file) throws IOException {
        return uploadStored(file);
    }

    private String uploadStored(MultipartFile file) throws IOException {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED.contains(contentType)) {
            throw new IllegalArgumentException("Unsupported image type: " + contentType);
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Image exceeds 5 MB limit");
        }

        // Whatever size arrives (up to the 5 MB upload limit), what is stored is at most ~200 KB (app.image.max-stored-kb).
        byte[] original = file.getBytes();
        ImageCompressor.Result img = ImageCompressor.compress(original, contentType, maxStoredBytes);
        log.info("Image {} KB -> {} KB ({})", original.length / 1024, img.bytes().length / 1024, img.contentType());
        String key = "images/" + UUID.randomUUID() + img.ext();

        // No public-read ACL: many buckets (Railway, AWS with "bucket owner enforced")
        // reject ACLs, so we keep the object private and stream it via the backend.
        s3.putObject(PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(img.contentType())
                        .build(),
                RequestBody.fromBytes(img.bytes()));

        // e.g. https://api.example.com/api/images/file/images/<uuid>.jpg
        return publicBaseUrl + "/api/images/file/" + key;
    }

    /**
     * Stores a profile picture: cropped to a centred square, 256 px, JPEG. Returns its URL (same proxy as other images).
     * Accepts PNG, JPEG and GIF (the first frame); anything else, or an unreadable file, is refused.
     */
    public String uploadAvatar(MultipartFile file) throws IOException {
        String ct = file.getContentType();
        if (ct == null || !Set.of("image/png", "image/jpeg", "image/gif").contains(ct))
            throw new IllegalArgumentException("Use a PNG, JPEG or GIF picture.");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("Image exceeds 5 MB limit");
        byte[] jpg = ImageCompressor.avatar(file.getBytes(), 256);
        String key = "avatars/" + UUID.randomUUID() + ".jpg";
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType("image/jpeg").build(), RequestBody.fromBytes(jpg));
        return publicBaseUrl + "/api/images/file/" + key;
    }

    /** Deletes a stored picture given the URL {@link #uploadAvatar} returned. Best effort: a failure only leaves an unused file behind. */
    public void deleteByUrl(String url) {
        try {
            String marker = "/api/images/file/";
            int i = url == null ? -1 : url.indexOf(marker);
            if (i < 0) return;
            String key = url.substring(i + marker.length());
            if (!key.startsWith("avatars/")) return;   // only ever removes profile pictures
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception e) {
            log.warn("Could not delete old picture: {}", e.getMessage());
        }
    }

    public record StoredImage(byte[] bytes, String contentType) {}

    // Fetches an object for the streaming proxy endpoint. Throws NoSuchKeyException if missing.
    public StoredImage fetch(String key) {
        ResponseBytes<GetObjectResponse> obj = s3.getObjectAsBytes(
                GetObjectRequest.builder().bucket(bucket).key(key).build());
        String ct = obj.response().contentType();
        return new StoredImage(obj.asByteArray(), ct != null ? ct : "application/octet-stream");
    }
}
