package com.JavaPlayground.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.JavaPlayground.service.GeminiService;

@RestController
@RequestMapping("/api/gemini")
public class GeminiController {

    private final GeminiService geminiService;

    public GeminiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    // Endpoint 1: Tests
    @PostMapping("/testcases")
    public Map<String, String> getTestCases(@RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        String result = geminiService.generateTestCases(code);
        return Map.of("testCases", result);
    }

    // Endpoint 2: Hints (THIS WAS MISSING)
    @PostMapping("/hints")
    public Map<String, String> getHints(@RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        String result = geminiService.generateHints(code);
        return Map.of("result", result);
    }
}
