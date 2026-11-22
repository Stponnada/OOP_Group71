package com.spotlight.itsm.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

interface EmployeeJpaRepository extends JpaRepository<EmployeeEntity, UUID> {

    Optional<EmployeeEntity> findByAuthUserIdAndActiveTrue(UUID authUserId);
}
