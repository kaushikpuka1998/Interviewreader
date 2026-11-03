package com.interview.backend.service;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class ImageCompressorTest {

    private static final int MAX = 200 * 1024;

    /** Random noise is the worst case for any compressor: a big photo-like image that starts in the megabytes. */
    private static byte[] noise(int w, int h, boolean alpha, String format) throws Exception {
        BufferedImage img = new BufferedImage(w, h, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Random r = new Random(1);
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int a = alpha && (x + y) % 7 == 0 ? 0 : 255;
            img.setRGB(x, y, (a << 24) | (r.nextInt(256) << 16) | (r.nextInt(256) << 8) | r.nextInt(256));
        }
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, format, bos);
        return bos.toByteArray();
    }

    @Test
    void bigOpaquePngBecomesJpegUnderBudget() throws Exception {
        byte[] in = noise(3000, 2000, false, "png");
        assertTrue(in.length > 4_000_000, "test input should be several MB, was " + in.length);
        var out = ImageCompressor.compress(in, "image/png", MAX);
        assertTrue(out.bytes().length <= MAX, "was " + out.bytes().length);
        assertEquals("image/jpeg", out.contentType());
        assertNotNull(ImageIO.read(new ByteArrayInputStream(out.bytes())));
    }

    /** A smooth gradient with transparent holes: the kind of diagram PNG handles well. */
    private static byte[] diagram(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int a = (x / 40 + y / 40) % 5 == 0 ? 0 : 255;
            img.setRGB(x, y, (a << 24) | ((x * 255 / w) << 16) | ((y * 255 / h) << 8) | 128);
        }
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bos);
        return bos.toByteArray();
    }

    @Test
    void transparentDiagramFitsBudget() throws Exception {
        byte[] in = diagram(2400, 1600);
        assertTrue(in.length > MAX, "test input should exceed the budget, was " + in.length);
        var out = ImageCompressor.compress(in, "image/png", MAX);
        assertTrue(out.bytes().length <= MAX, "was " + out.bytes().length);
        assertNotNull(ImageIO.read(new ByteArrayInputStream(out.bytes())));
    }

    @Test
    void transparentNoiseFallsBackToJpegUnderBudget() throws Exception {
        var out = ImageCompressor.compress(noise(1200, 800, true, "png"), "image/png", MAX);
        assertTrue(out.bytes().length <= MAX, "was " + out.bytes().length);
        assertEquals("image/jpeg", out.contentType());
    }

    @Test
    void smallImageIsStoredUntouched() throws Exception {
        byte[] in = noise(60, 40, false, "png");
        var out = ImageCompressor.compress(in, "image/png", MAX);
        assertSame(in, out.bytes());
    }

    @Test
    void oversizedSvgAndWebpAreRejectedNotCorrupted() {
        byte[] big = new byte[MAX + 1];
        assertThrows(IllegalArgumentException.class, () -> ImageCompressor.compress(big, "image/svg+xml", MAX));
        assertThrows(IllegalArgumentException.class, () -> ImageCompressor.compress(big, "image/webp", MAX));
    }

    @Test
    void garbageThatIsNotAnImageIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> ImageCompressor.compress(new byte[MAX + 10], "image/png", MAX));
    }
}
