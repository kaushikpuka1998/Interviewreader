package com.interview.backend.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

/**
 * Redis-backed caching for read-heavy, effectively-static question data.
 *
 * Values are stored as human-readable JSON (with an @class type hint). Paginated
 * results use {@link CachedPage} so Spring's Page can round-trip through JSON.
 * Short TTL keeps content fresh; writes evict (see QuestionService).
 *
 * Connection is auto-configured from spring.data.redis.* (host/port/password or url).
 * If Redis is unavailable, the error handler logs and falls through to the DB — the
 * app keeps working (just uncached) instead of failing requests.
 */
@Configuration
@EnableCaching
@Slf4j
public class CacheConfig implements CachingConfigurer {

    @Bean
    public RedisCacheConfiguration cacheConfiguration() {
        // JSON serializer: registers Java-time support and embeds @class so polymorphic
        // types (Question, CachedPage, …) can be read back.
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.activateDefaultTyping(
                BasicPolymorphicTypeValidator.builder().allowIfSubType(Object.class).build(),
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY);
        GenericJackson2JsonRedisSerializer json = new GenericJackson2JsonRedisSerializer(mapper);

        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .prefixCacheNameWith("ir:")
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(json));
    }

    /** A member's Premium end date is kept for an hour (BillingService.isPremium); every change clears it, and the date itself keeps it correct over time. */
    @Bean
    public org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer premiumCacheTtl(RedisCacheConfiguration base) {
        return b -> b.withCacheConfiguration("premium", base.entryTtl(Duration.ofHours(1)));
    }

    /** Never let a Redis hiccup break a request — log and bypass the cache. */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache GET failed ({}), falling back to DB: {}", cache.getName(), e.getMessage());
            }
            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                log.warn("Cache PUT failed ({}): {}", cache.getName(), e.getMessage());
            }
            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache EVICT failed ({}): {}", cache.getName(), e.getMessage());
            }
            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                log.warn("Cache CLEAR failed ({}): {}", cache.getName(), e.getMessage());
            }
        };
    }
}
