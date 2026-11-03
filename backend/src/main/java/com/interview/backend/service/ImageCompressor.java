package com.interview.backend.service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * Shrinks an uploaded picture until it fits a byte budget (default 200 KB), whatever size it arrived at.
 *
 * <ul>
 *   <li>Already small enough: stored untouched, so nothing is re-encoded for no reason.</li>
 *   <li>Opaque pictures (photos, screenshots): capped at 1600 px on the long side, then saved as JPEG, lowering the quality
 *       step by step (0.85 to 0.45) and, if that is still too big, the pixel size, until it fits.</li>
 *   <li>Pictures with real transparency (diagrams): kept as PNG so the transparency survives, shrinking the pixel size a few times;
 *       if still too big, flattened onto white and saved as JPEG like any photo.</li>
 *   <li>GIF: if too big it becomes a still picture (the first frame); animation can't be kept at this size.</li>
 *   <li>SVG and WebP: vector or undecodable here, so they pass only if already under the budget.</li>
 * </ul>
 * ponytail: ImageIO ignores the EXIF "rotate" flag, so a sideways phone photo stays sideways; add metadata-extractor if that matters.
 */
public final class ImageCompressor {

    public record Result(byte[] bytes, String contentType, String ext) {}

    private static final int MAX_SIDE = 1600;
    private static final int MIN_SIDE = 320;
    private static final long MAX_PIXELS = 40_000_000L;   // refuses decompression bombs before decoding
    private static final float[] QUALITIES = {0.85f, 0.75f, 0.65f, 0.55f, 0.45f};

    private ImageCompressor() {}

    public static Result compress(byte[] in, String contentType, int maxBytes) throws IOException {
        boolean vectorOrOpaque = "image/svg+xml".equals(contentType) || "image/webp".equals(contentType);
        if (in.length <= maxBytes) return new Result(in, contentType, extOf(contentType));
        if (vectorOrOpaque) {
            throw new IllegalArgumentException(("image/svg+xml".equals(contentType) ? "SVG" : "WebP") + " images must already be under "
                    + maxBytes / 1024 + " KB. Upload a PNG or JPEG and it is compressed for you.");
        }

        BufferedImage img = decode(in);
        img = fit(img, MAX_SIDE);
        boolean transparent = hasTransparency(img);

        int w = img.getWidth(), h = img.getHeight(), pngTries = 4;
        while (true) {
            BufferedImage cur = (w == img.getWidth()) ? img : resize(img, w, h);
            // Lossless PNG gets a few shrinking tries; a picture that stays too big (photo-like with transparency) falls back to a
            // flattened JPEG so the size limit always wins over keeping the transparency.
            if (transparent && pngTries-- > 0) {
                byte[] png = write(cur, "png", -1);
                if (png.length <= maxBytes) return new Result(png, "image/png", ".png");
            } else {
                BufferedImage rgb = flatten(cur);
                for (float q : QUALITIES) {
                    byte[] jpg = write(rgb, "jpeg", q);
                    if (jpg.length <= maxBytes) return new Result(jpg, "image/jpeg", ".jpg");
                }
            }
            w = (int) (w * 0.85);
            h = (int) (h * 0.85);
            if (Math.min(w, h) < MIN_SIDE) {
                throw new IllegalArgumentException("This image can't be compressed under " + maxBytes / 1024 + " KB without becoming unreadable. Try a simpler image.");
            }
        }
    }

    private static BufferedImage decode(byte[] in) throws IOException {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(in))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) throw new IllegalArgumentException("This image could not be read.");
            ImageReader r = readers.next();
            try {
                r.setInput(iis, true, true);
                if ((long) r.getWidth(0) * r.getHeight(0) > MAX_PIXELS) throw new IllegalArgumentException("Image dimensions are too large.");
                return r.read(0);
            } finally {
                r.dispose();
            }
        }
    }

    private static boolean hasTransparency(BufferedImage img) {
        if (!img.getColorModel().hasAlpha()) return false;
        for (int y = 0; y < img.getHeight(); y++)
            for (int x = 0; x < img.getWidth(); x++)
                if ((img.getRGB(x, y) >>> 24) < 255) return true;
        return false;
    }

    /** Scales down so the long side is at most {@code max}, keeping the ratio. Never enlarges. */
    private static BufferedImage fit(BufferedImage img, int max) {
        int w = img.getWidth(), h = img.getHeight(), side = Math.max(w, h);
        if (side <= max) return img;
        double k = (double) max / side;
        return resize(img, Math.max(1, (int) Math.round(w * k)), Math.max(1, (int) Math.round(h * k)));
    }

    /** Halves repeatedly while the target is under half the size (avoids jagged edges), then one smooth final step. */
    private static BufferedImage resize(BufferedImage src, int w, int h) {
        BufferedImage cur = src;
        while (cur.getWidth() / 2 >= w && cur.getHeight() / 2 >= h) cur = draw(cur, cur.getWidth() / 2, cur.getHeight() / 2);
        return (cur.getWidth() == w && cur.getHeight() == h) ? cur : draw(cur, w, h);
    }

    private static BufferedImage draw(BufferedImage src, int w, int h) {
        int type = src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage out = new BufferedImage(w, h, type);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    /** JPEG has no alpha: paint over white (a transparent corner would otherwise turn black). */
    private static BufferedImage flatten(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) return src;
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, out.getWidth(), out.getHeight());
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    private static byte[] write(BufferedImage img, String format, float quality) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageWriter writer = ImageIO.getImageWritersByFormatName(format).next();
        try (MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(bos)) {
            writer.setOutput(out);
            ImageWriteParam p = writer.getDefaultWriteParam();
            if (quality >= 0 && p.canWriteCompressed()) {
                p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                p.setCompressionQuality(quality);
                if (p.canWriteProgressive()) p.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
            }
            writer.write(null, new IIOImage(img, null, null), p);
        } finally {
            writer.dispose();
        }
        return bos.toByteArray();
    }

    static String extOf(String contentType) {
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/svg+xml" -> ".svg";
            default -> "";
        };
    }
}
