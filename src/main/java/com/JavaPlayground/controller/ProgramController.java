package com.JavaPlayground.controller;

import com.JavaPlayground.model.Program;
import com.JavaPlayground.model.User;
import com.JavaPlayground.repository.ProgramRepository;
import com.JavaPlayground.repository.UserRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/programs")
public class ProgramController {

    private final ProgramRepository programRepository;
    private final UserRepository userRepository;

    public ProgramController(ProgramRepository programRepository, UserRepository userRepository) {
        this.programRepository = programRepository;
        this.userRepository = userRepository;
    }

    // --- 1. Robust User Lookup ---
    private User getAuthenticatedUser(OAuth2User principal) {
        if (principal == null) {
            return null;
        }

        // A. Try finding by Email (Google standard)
        String email = principal.getAttribute("email");
        if (email != null) {
            Optional<User> user = userRepository.findByEmail(email);
            if (user.isPresent()) {
                return user.get();
            }
        }

        // B. Try finding by Login (GitHub username)
        String login = principal.getAttribute("login");
        if (login != null) {
            // Check if we stored the login in the 'name' field
            Optional<User> userByName = userRepository.findByName(login);
            if (userByName.isPresent()) {
                return userByName.get();
            }
        }

        // C. Try finding by Display Name
        String name = principal.getAttribute("name");
        if (name != null) {
            Optional<User> userByName = userRepository.findByName(name);
            if (userByName.isPresent()) {
                return userByName.get();
            }
        }

        return null; // User is logged in via OAuth, but NOT in our Database
    }

    // --- 2. Auto-Register Missing Users (Self-Healing) ---
    private User createMissingUser(OAuth2User principal) {
        String email = principal.getAttribute("email");
        String name = principal.getAttribute("name");
        String login = principal.getAttribute("login");
        String avatar = principal.getAttribute("avatar_url");

        // Fallbacks for GitHub
        if (name == null) {
            name = login;
        }
        if (email == null && login != null) {
            email = login + "@github.user"; // Placeholder email
        }
        User newUser = new User();
        newUser.setName(name);
        newUser.setEmail(email);
        newUser.setProvider("github");
        // newUser.setAvatar(avatar); // If you have an avatar field in User model

        return userRepository.save(newUser);
    }

    // --- API ENDPOINTS ---
    @GetMapping
    public List<Program> getMyPrograms(@AuthenticationPrincipal OAuth2User principal) {
        User user = getAuthenticatedUser(principal);
        if (user == null) {
            return List.of();
        }
        return programRepository.findByUserOrderByIdDesc(user);
    }

    @PostMapping
    public Program saveProgram(@AuthenticationPrincipal OAuth2User principal, @RequestBody Map<String, String> payload) {
        if (principal == null) {
            throw new RuntimeException("Not logged in");
        }

        // 1. Get User from DB
        User user = getAuthenticatedUser(principal);

        // 2. If User is missing (GitHub issue), Auto-Register them now!
        if (user == null) {
            user = createMissingUser(principal);
        }

        // 3. Proceed to Save
        String code = payload.get("code");
        String name = payload.get("title");
        String idStr = payload.get("id");

        Program program;
        if (idStr != null && !idStr.isEmpty()) {
            Long id = Long.parseLong(idStr);
            program = programRepository.findById(id).orElseThrow(() -> new RuntimeException("Program not found"));

            if (!program.getUser().getId().equals(user.getId())) {
                throw new RuntimeException("Unauthorized");
            }
            program.setCode(code);
            program.setName(name);
        } else {
            program = new Program(name, code, user);
        }

        return programRepository.save(program);
    }

    @DeleteMapping("/{id}")
    public void deleteProgram(@AuthenticationPrincipal OAuth2User principal, @PathVariable Long id) {
        User user = getAuthenticatedUser(principal);
        if (user == null) {
            return;
        }

        Program p = programRepository.findById(id).orElse(null);
        if (p != null && p.getUser().getId().equals(user.getId())) {
            programRepository.delete(p);
        }
    }
}
