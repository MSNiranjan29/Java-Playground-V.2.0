package com.JavaPlayground.service;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    // --- 1. BRUTAL TESTER (QA Mode) ---
    public String generateTestCases(String code) {
        // Prompt focus: BREAK THE CODE. No advice, just inputs/outputs.
        String prompt = "You are a Senior QA Engineer. Your goal is to BRUTALLY break the following Java code.\n"
                + "Generate 10 distinct test cases. Focus strictly on boundary values, edge cases (0, -1, null), and logical traps.\n\n"
                + "Format strictly as:\n"
                + "Input: <raw input>\n"
                + "Expected Output: <mathematically correct answer>\n"
                + "[Reason: <why this breaks the code>]\n\n"
                + "Do NOT provide hints or fixes. Just the test cases.\n\n"
                + "Code:\n" + code;

        return callGeminiApi(prompt);
    }

    // --- 2. HINT GIVER (Mentor Mode) ---
    public String generateHints(String code) {
        // Prompt focus: ANALYZE LOGIC. Find missing lines, syntax errors, or bad logic.
        String prompt = "You are a Lead Java Developer mentoring a student.\n"
                + "Analyze the following code for Logic Errors, Missing Lines, and Syntax issues.\n"
                + "If you see a prompt like 'Enter name' but no `sc.nextLine()` follows it, flag it immediately.\n"
                + "If the code is perfect, suggest a performance optimization.\n\n"
                + "Format strictly as:\n"
                + "1. **Observation:** <What is wrong?>\n"
                + "2. **Fix:** <How to solve it?>\n"
                + "3. **Concept:** <Explain the concept briefly>\n\n"
                + "Code:\n" + code;

        return callGeminiApi(prompt);
    }

    // --- Helper Method to handle the API Call ---
    private String callGeminiApi(String prompt) {
        try {
            // 1. Prepare Request Body
            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("text", prompt)
                            ))
                    )
            );

            // 2. Prepare Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // 3. Send Request
            String finalUrl = apiUrl + "?key=" + apiKey;
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(finalUrl, entity, Map.class);

            // 4. Parse Response
            Map<String, Object> body = response.getBody();
            if (body != null) {
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
                if (candidates != null && !candidates.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                    return (String) parts.get(0).get("text");
                }
            }
            return "AI provided no response.";

        } catch (Exception e) {
            e.printStackTrace();
            return "Error calling Gemini API: " + e.getMessage();
        }
    }
}
