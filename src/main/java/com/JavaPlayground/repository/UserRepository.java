package com.JavaPlayground.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.JavaPlayground.model.User;

public interface UserRepository extends JpaRepository<User, Long> {

    // Used for OAuth login (Email + Provider)
    Optional<User> findByEmailAndProvider(String email, String provider);

    // Used for Program Saving (Email only)
    Optional<User> findByEmail(String email);

    // ADD THIS: Used for GitHub fallback (Username/Login)
    Optional<User> findByName(String name);
}
