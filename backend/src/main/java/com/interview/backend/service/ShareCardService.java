package com.interview.backend.service;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Draws the 1200x627 picture LinkedIn (and other sites) show for a shared link: a question card, a company
 * roadmap card, or a member's progress certificate. Plain Java2D, no extra libraries; fonts come from the OS
 * ("SansSerif" = DejaVu Sans in the Docker image, installed in the Dockerfile).
 */
@Service
public class ShareCardService {

    private static final int W = 1200, H = 627;
    private static final Color INK = new Color(0x0d1512), DEEP = new Color(0x06352a), MINT = new Color(0x34d399),
            GREEN = new Color(0x047857), PALE = new Color(0xd1fae5), GOLD = new Color(0xfbbf24);

    // ponytail: small in-memory cache of rendered cards; LinkedIn fetches each image once and caches it too.
    private final Map<String, byte[]> cache = java.util.Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, byte[]> e) { return size() > 300; }
    });

    public record Stat(String value, String label) {}

    public byte[] question(String title, String topic, String difficulty) {
        return cached("q|" + title + "|" + topic + "|" + difficulty, g -> {
            background(g);
            brand(g, 70, 60);
            g.setFont(font(Font.BOLD, 58));
            g.setColor(Color.WHITE);
            int y = 230;
            for (String line : wrap(g, title, W - 140, 3)) { g.drawString(line, 70, y); y += 72; }
            int x = 70;
            for (String c : new String[]{topic, difficulty}) if (c != null && !c.isBlank()) x = chip(g, c, x, y + 10) + 14;
            footer(g, "Interview question · detailed answer, code and diagrams");
        });
    }

    public byte[] roadmap(String company, String tagline, List<String> rounds) {
        return cached("r|" + company + "|" + tagline + "|" + rounds, g -> {
            background(g);
            brand(g, 70, 60);
            g.setColor(MINT);
            g.setFont(font(Font.BOLD, 26));
            g.drawString("INTERVIEW ROADMAP", 70, 200);
            g.setColor(Color.WHITE);
            g.setFont(font(Font.BOLD, 70));
            g.drawString(fit(g, company, W - 140), 70, 280);
            g.setFont(font(Font.PLAIN, 32));
            g.setColor(PALE);
            int y = 340;
            for (String line : wrap(g, tagline, W - 140, 2)) { g.drawString(line, 70, y); y += 44; }
            int x = 70, row = y + 20;
            g.setFont(font(Font.BOLD, 22));
            for (int i = 0; i < rounds.size() && i < 4; i++) {
                String label = (i + 1) + ". " + rounds.get(i);
                if (x + g.getFontMetrics().stringWidth(label) + 40 > W - 70) break;
                x = chip(g, label, x, row) + 12;
            }
            footer(g, "DSA · System design · Behavioral, round by round");
        });
    }

    /** A progress certificate. Same name and numbers give the same picture, so it's cached until they change. */
    public byte[] certificate(String name, List<Stat> stats, String issued, String url) {
        return cached("c|" + name + "|" + stats + "|" + issued + "|" + url, g -> {
            g.setPaint(new GradientPaint(0, 0, new Color(0xf8fcfb), W, H, new Color(0xe1efea)));
            g.fillRect(0, 0, W, H);
            g.setColor(GREEN);
            g.setStroke(new BasicStroke(6));
            g.draw(new RoundRectangle2D.Double(24, 24, W - 48, H - 48, 28, 28));
            g.setColor(new Color(4, 120, 87, 90));
            g.setStroke(new BasicStroke(1.5f));
            g.draw(new RoundRectangle2D.Double(40, 40, W - 80, H - 80, 20, 20));

            logo(g, 70, 66, 1.1);
            g.setColor(INK);
            g.setFont(font(Font.BOLD, 26));
            g.drawString("Interview Reader", 158, 114);

            seal(g, W - 170, 120);

            g.setColor(GREEN);
            g.setFont(font(Font.BOLD, 24));
            center(g, "CERTIFICATE OF PROGRESS", 205);
            g.setColor(new Color(0x445951));
            g.setFont(font(Font.PLAIN, 24));
            center(g, "This is to recognise", 250);
            g.setColor(INK);
            g.setFont(font(Font.BOLD, 62));
            center(g, fit(g, name, W - 300), 322);
            g.setColor(new Color(0x445951));
            g.setFont(font(Font.PLAIN, 24));
            center(g, "for consistent interview preparation on Interview Reader", 368);

            int n = Math.max(1, stats.size()), boxW = 220, gap = 24, total = n * boxW + (n - 1) * gap, x = (W - total) / 2;
            for (Stat s : stats) {
                g.setColor(Color.WHITE);
                g.fill(new RoundRectangle2D.Double(x, 400, boxW, 110, 20, 20));
                g.setColor(new Color(0xcbe1d9));
                g.setStroke(new BasicStroke(1.5f));
                g.draw(new RoundRectangle2D.Double(x, 400, boxW, 110, 20, 20));
                g.setColor(GREEN);
                g.setFont(font(Font.BOLD, 40));
                FontMetrics fm = g.getFontMetrics();
                g.drawString(s.value(), x + (boxW - fm.stringWidth(s.value())) / 2, 457);
                g.setColor(new Color(0x5d756c));
                g.setFont(font(Font.PLAIN, 20));
                fm = g.getFontMetrics();
                g.drawString(s.label(), x + (boxW - fm.stringWidth(s.label())) / 2, 490);
                x += boxW + gap;
            }
            g.setColor(new Color(0x5d756c));
            g.setFont(font(Font.PLAIN, 20));
            g.drawString("Issued " + issued, 80, 572);
            FontMetrics fm = g.getFontMetrics();
            g.setColor(GREEN);
            g.setFont(font(Font.BOLD, 20));
            fm = g.getFontMetrics();
            g.drawString(url, W - 80 - fm.stringWidth(url), 572);
        });
    }

    // ---------- drawing helpers ----------

    private byte[] cached(String key, Consumer<Graphics2D> draw) {
        return cache.computeIfAbsent(key, k -> {
            BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = img.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            draw.accept(g);
            g.dispose();
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                ImageIO.write(img, "png", out);
                return out.toByteArray();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
    }

    private static Font font(int style, float size) {
        return new Font(Font.SANS_SERIF, style, 1).deriveFont(size);
    }

    private static void background(Graphics2D g) {
        g.setPaint(new GradientPaint(0, 0, INK, W, H, DEEP));
        g.fillRect(0, 0, W, H);
        g.setPaint(new RadialGradientPaint(new Point2D.Float(1060, 70), 540, new float[]{0f, 1f},
                new Color[]{new Color(16, 185, 129, 95), new Color(16, 185, 129, 0)}));
        g.fillRect(0, 0, W, H);
    }

    private static void brand(Graphics2D g, int x, int y) {
        logo(g, x, y, 1.0);
        g.setColor(Color.WHITE);
        g.setFont(font(Font.BOLD, 30));
        g.drawString("Interview Reader", x + 82, y + 44);
    }

    private static void footer(Graphics2D g, String left) {
        g.setColor(new Color(255, 255, 255, 40));
        g.fillRect(0, H - 70, W, 70);
        g.setFont(font(Font.PLAIN, 22));
        g.setColor(PALE);
        g.drawString(left, 70, H - 28);
        g.setFont(font(Font.BOLD, 22));
        g.setColor(MINT);
        String url = "interviewreader.cloud";
        g.drawString(url, W - 70 - g.getFontMetrics().stringWidth(url), H - 28);
    }

    private static int chip(Graphics2D g, String text, int x, int y) {
        g.setFont(font(Font.BOLD, 22));
        int w = g.getFontMetrics().stringWidth(text) + 36;
        g.setColor(new Color(255, 255, 255, 30));
        g.fill(new RoundRectangle2D.Double(x, y, w, 44, 44, 44));
        g.setColor(new Color(255, 255, 255, 80));
        g.setStroke(new BasicStroke(1.5f));
        g.draw(new RoundRectangle2D.Double(x, y, w, 44, 44, 44));
        g.setColor(Color.WHITE);
        g.drawString(text, x + 18, y + 30);
        return x + w;
    }

    private static void center(Graphics2D g, String text, int y) {
        g.drawString(text, (W - g.getFontMetrics().stringWidth(text)) / 2, y);
    }

    /** Gold rosette with a star: the "seal" on the certificate. */
    private static void seal(Graphics2D g, int cx, int cy) {
        g.setColor(new Color(0xf59e0b));
        Path2D ribbon = new Path2D.Double();
        ribbon.moveTo(cx - 30, cy + 30); ribbon.lineTo(cx - 48, cy + 92); ribbon.lineTo(cx - 24, cy + 80);
        ribbon.lineTo(cx - 10, cy + 100); ribbon.lineTo(cx + 4, cy + 40); ribbon.closePath();
        g.fill(ribbon);
        ribbon = new Path2D.Double();
        ribbon.moveTo(cx + 30, cy + 30); ribbon.lineTo(cx + 48, cy + 92); ribbon.lineTo(cx + 24, cy + 80);
        ribbon.lineTo(cx + 10, cy + 100); ribbon.lineTo(cx - 4, cy + 40); ribbon.closePath();
        g.fill(ribbon);
        g.setPaint(new GradientPaint(cx - 50, cy - 50, GOLD, cx + 50, cy + 50, new Color(0xd97706)));
        g.fill(new Ellipse2D.Double(cx - 52, cy - 52, 104, 104));
        g.setColor(new Color(255, 255, 255, 170));
        g.setStroke(new BasicStroke(2.5f));
        g.draw(new Ellipse2D.Double(cx - 42, cy - 42, 84, 84));
        g.setColor(Color.WHITE);
        Path2D star = new Path2D.Double();
        for (int i = 0; i < 10; i++) {
            double r = i % 2 == 0 ? 26 : 11, a = -Math.PI / 2 + i * Math.PI / 5;
            double px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
            if (i == 0) star.moveTo(px, py); else star.lineTo(px, py);
        }
        star.closePath();
        g.fill(star);
    }

    /** The app logo (open book with a spark), drawn from the same shapes as logo.svg. 64 units = 64px at scale 1. */
    private static void logo(Graphics2D g, int x, int y, double s) {
        AffineTransform saved = g.getTransform();
        g.translate(x, y);
        g.scale(s, s);
        g.setPaint(new GradientPaint(0, 0, MINT, 64, 64, GREEN));
        g.fill(new RoundRectangle2D.Double(0, 0, 64, 64, 30, 30));
        g.setColor(Color.WHITE);
        Path2D left = new Path2D.Double();
        left.moveTo(32, 27); left.curveTo(26, 23, 18, 23, 11, 25.5); left.lineTo(11, 47); left.curveTo(18, 44.5, 26, 44.5, 32, 48.5); left.closePath();
        g.fill(left);
        g.setColor(new Color(255, 255, 255, 225));
        Path2D right = new Path2D.Double();
        right.moveTo(32, 27); right.curveTo(38, 23, 46, 23, 53, 25.5); right.lineTo(53, 47); right.curveTo(46, 44.5, 38, 44.5, 32, 48.5); right.closePath();
        g.fill(right);
        g.setColor(GREEN);
        g.setStroke(new BasicStroke(2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.draw(new Line2D.Double(32, 27, 32, 48.5));
        g.setColor(Color.WHITE);
        double[][] p = {{32, 7}, {34.3, 12.2}, {39.5, 14.5}, {34.3, 16.8}, {32, 22}, {29.7, 16.8}, {24.5, 14.5}, {29.7, 12.2}};
        Path2D spark = new Path2D.Double();
        spark.moveTo(p[0][0], p[0][1]);
        for (int i = 1; i < p.length; i++) spark.lineTo(p[i][0], p[i][1]);
        spark.closePath();
        g.fill(spark);
        g.setTransform(saved);
    }

    /** Word-wraps text to at most maxLines lines; the last one ends with "…" when the text doesn't fit. */
    static List<String> wrap(Graphics2D g, String text, int maxWidth, int maxLines) {
        FontMetrics fm = g.getFontMetrics();
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        String[] words = String.valueOf(text == null ? "" : text).trim().split("\\s+");
        for (int i = 0; i < words.length; i++) {
            String next = line.isEmpty() ? words[i] : line + " " + words[i];
            if (fm.stringWidth(next) <= maxWidth) { line = new StringBuilder(next); continue; }
            if (!line.isEmpty()) lines.add(line.toString());
            line = new StringBuilder(words[i]);
            if (lines.size() == maxLines) break;
        }
        if (lines.size() < maxLines && !line.isEmpty()) lines.add(line.toString());
        if (lines.size() > maxLines) lines = lines.subList(0, maxLines);
        String joined = String.join(" ", lines);
        if (!joined.equals(String.join(" ", words)) && !lines.isEmpty()) {
            int last = lines.size() - 1;
            lines.set(last, fit(g, lines.get(last) + " …", maxWidth));
        }
        return lines;
    }

    /** Shortens text with "…" until it fits the width. */
    static String fit(Graphics2D g, String text, int maxWidth) {
        FontMetrics fm = g.getFontMetrics();
        String s = text == null ? "" : text;
        if (fm.stringWidth(s) <= maxWidth) return s;
        while (s.length() > 1 && fm.stringWidth(s + "…") > maxWidth) s = s.substring(0, s.length() - 1);
        return s.trim() + "…";
    }
}
