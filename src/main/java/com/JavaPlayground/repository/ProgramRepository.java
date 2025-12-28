package com.JavaPlayground.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.JavaPlayground.model.Program;
import com.JavaPlayground.model.User;

public interface ProgramRepository extends JpaRepository<Program, Long> {

    // Find all programs for a specific User entity
    List<Program> findByUserOrderByIdDesc(User user);
}
