package com.interview.backend.service;

/** The same URL slug the frontend builds from a question title (lib/slug.js). */
public final class ShareSlug {
    private ShareSlug() {}

    public static String of(String title) {
        String s = String.valueOf(title == null ? "" : title).toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return s.length() > 80 ? s.substring(0, 80) : s;
    }
}
