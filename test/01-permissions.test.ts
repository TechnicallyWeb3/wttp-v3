import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { TestPermissions } from "../typechain-types";

describe("TestPermissions", function () {
  let testPermissions: TestPermissions;
  let owner: any;
  let siteAdmin: any;
  let publicUser: any;
  let blacklistedUser: any;
  let superAdminRole: any;
  let siteAdminRole: any;
  let publicRole: any;

  // Fixture to deploy the contract once and reuse it across tests
  async function deployTestPermissionsFixture() {
    [owner, siteAdmin, publicUser, blacklistedUser] = await hre.ethers.getSigners();
    
    const TestPermissions = await hre.ethers.getContractFactory("TestPermissions");
    testPermissions = await TestPermissions.deploy(owner.address);
    
    return { testPermissions, owner, siteAdmin, publicUser, blacklistedUser };
  }

  describe("Role Getters", function () {
    it("Should return the correct role identifiers", async function () {
      const { testPermissions } = await loadFixture(deployTestPermissionsFixture);
      
      // Get the roles
      superAdminRole = await testPermissions.getSuperAdminRole();
      siteAdminRole = await testPermissions.getSiteAdminRole();
      
      // Test that they're different from each other
      expect(superAdminRole).to.not.equal(siteAdminRole);
      expect(superAdminRole).to.not.equal(publicRole);
      expect(siteAdminRole).to.not.equal(publicRole);
    });
  });

  describe("Role Checking", function () {
    it("Should correctly identify owner as super admin", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      expect(await testPermissions.isSuperAdmin(owner.address)).to.be.true;
    });
    
    it("Should correctly identify owner as site admin", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      expect(await testPermissions.isSiteAdmin(owner.address)).to.be.true;
    });
    
    // it("Should correctly identify users as public by default", async function () {
    //   const { testPermissions, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
    //   // By default, users should be public (not blacklisted)
    //   expect(await testPermissions.isPublic(publicUser.address)).to.be.true;
    // });
  });

  describe("Role Management - Owner", function () {
    it("Should allow owner to grant site admin role", async function () {
      const { testPermissions, owner, siteAdmin } = await loadFixture(deployTestPermissionsFixture);
      
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      expect(await testPermissions.isSiteAdmin(siteAdmin.address)).to.be.true;
    });
    
    // it("Should allow owner to blacklist a user", async function () {
    //   const { testPermissions, owner, blacklistedUser } = await loadFixture(deployTestPermissionsFixture);
      
    //   const isPublic = await testPermissions.isPublic(blacklistedUser.address);
    // //   console.log("isPublic", isPublic);
    //   expect(isPublic).to.be.true;

    //   const tx = testPermissions.connect(owner).blacklistPublicRole(blacklistedUser.address);
    //   await expect(tx).to.emit(testPermissions, "AccountBlacklisted").withArgs(blacklistedUser.address);
    //   await (await tx).wait();
    //   const isPublicAfter = await testPermissions.isPublic(blacklistedUser.address);
    // //   console.log("isPublicAfter", isPublicAfter);
    //   expect(isPublicAfter).to.be.false;
      
    //   // After granting PUBLIC_ROLE, user should be blacklisted (not public)
    //   expect(await testPermissions.hasRole(publicRole, blacklistedUser.address)).to.be.true;
    // });
    
    it("Should allow owner to revoke roles", async function () {
      const { testPermissions, owner, siteAdmin } = await loadFixture(deployTestPermissionsFixture);
      
      // First grant the role
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      expect(await testPermissions.isSiteAdmin(siteAdmin.address)).to.be.true;
      
      // Then revoke it
      await testPermissions.connect(owner).revokeRole(siteAdminRole, siteAdmin.address);
      expect(await testPermissions.isSiteAdmin(siteAdmin.address)).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("Should allow granting the same role to a user multiple times without error", async function () {
      const { testPermissions, owner, siteAdmin } = await loadFixture(deployTestPermissionsFixture);
      
      // Grant site admin role first time
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      expect(await testPermissions.isSiteAdmin(siteAdmin.address)).to.be.true;
      
      // Grant the same role again - should not error
      await expect(testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address))
        .to.not.be.reverted;
        
      // User should still have the role
      expect(await testPermissions.isSiteAdmin(siteAdmin.address)).to.be.true;
    });
    
    it("Should handle non-existent roles correctly", async function () {
      const { testPermissions, owner, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Create a custom role that hasn't been used before
      const nonExistentRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_ROLE"));
      
      // Should be able to grant the role even though it doesn't "exist" yet
      await expect(testPermissions.connect(owner).grantRole(nonExistentRole, publicUser.address))
        .to.not.be.reverted;
        
      // Should be able to check if user has this role
      expect(await testPermissions.hasRole(nonExistentRole, publicUser.address)).to.be.true;
      
      // Should be able to revoke this role
      await expect(testPermissions.connect(owner).revokeRole(nonExistentRole, publicUser.address))
        .to.not.be.reverted;
      
      expect(await testPermissions.hasRole(nonExistentRole, publicUser.address)).to.be.false;
    });
    
    it("Should allow multiple users to have the same custom role", async function () {
      const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Create a custom role
      const customRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CUSTOM_SHARED_ROLE"));
      
      // Grant to multiple users
      await testPermissions.connect(owner).grantRole(customRole, siteAdmin.address);
      await testPermissions.connect(owner).grantRole(customRole, publicUser.address);
      
      // Both should have the role
      expect(await testPermissions.hasRole(customRole, siteAdmin.address)).to.be.true;
      expect(await testPermissions.hasRole(customRole, publicUser.address)).to.be.true;
    });
  });

  describe("Role-Based Access Control", function () {
    it("Should allow super admin to call testSuperAdmin", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      // This should not revert as owner is a super admin
      await expect(testPermissions.connect(owner).testSuperAdmin(owner.address))
        .to.not.be.reverted;
    });
    
    it("Should not allow non-admin to call testSuperAdmin", async function () {
      const { testPermissions, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // This should revert as publicUser is not a super admin
      await expect(testPermissions.connect(publicUser).testSuperAdmin(publicUser.address))
        .to.be.reverted;
    });
    
    it("Should allow site admin to call testSiteAdmin", async function () {
      const { testPermissions, owner, siteAdmin } = await loadFixture(deployTestPermissionsFixture);
      
      // Grant site admin role
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // This should not revert as siteAdmin is now a site admin
      await expect(testPermissions.connect(siteAdmin).testSiteAdmin(siteAdmin.address))
        .to.not.be.reverted;
    });
    
    // it("Should allow public users to call testPublic", async function () {
    //   const { testPermissions, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
    //   // This should not revert as publicUser is public by default
    //   await expect(testPermissions.connect(publicUser).testPublic(publicUser.address))
    //     .to.not.be.reverted;
    // });
    
    // it("Should not allow blacklisted users to call testPublic", async function () {
    //   const { testPermissions, owner, blacklistedUser } = await loadFixture(deployTestPermissionsFixture);
      
    //   // Blacklist the user
    //   const tx = await testPermissions.connect(owner).blacklistPublicRole(blacklistedUser.address);
    //   await tx.wait();
      
    //   // This should revert as blacklistedUser is no longer public
    //   await expect(testPermissions.connect(blacklistedUser).testPublic(blacklistedUser.address))
    //     .to.be.reverted;
    // });
  });

  describe("Role Management - Site Admin", function () {
    it("Should not allow site admin to grant site admin role to others", async function () {
      const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // First make siteAdmin a site admin
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      expect(await testPermissions.isSiteAdmin(siteAdmin.address)).to.be.true;
      
      // Site admin should not be able to grant site admin role to others
      await expect(testPermissions.connect(siteAdmin).grantRole(siteAdminRole, publicUser.address))
        .to.be.reverted;
    });
    
    it("Should allow site admin to create and manage resource admin roles", async function () {
      const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Make siteAdmin a site admin
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Create a resource admin role
      const resourceAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
      await testPermissions.connect(siteAdmin).createResourceRole(resourceAdminRole);
      
      // Site admin should be able to grant resource admin role
      await expect(testPermissions.connect(siteAdmin).grantRole(resourceAdminRole, publicUser.address))
        .to.not.be.reverted;
        
      expect(await testPermissions.hasRole(resourceAdminRole, publicUser.address)).to.be.true;
      
      // Site admin should be able to revoke resource admin role
      await expect(testPermissions.connect(siteAdmin).revokeRole(resourceAdminRole, publicUser.address))
        .to.not.be.reverted;
        
      expect(await testPermissions.hasRole(resourceAdminRole, publicUser.address)).to.be.false;
    });
    
    // it("Should allow site admin to blacklist users", async function () {
    //   const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
    //   // Make siteAdmin a site admin
    //   await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
    //   // Check user is public initially
    //   expect(await testPermissions.isPublic(publicUser.address)).to.be.true;
      
    //   // Site admin should be able to blacklist a user
    //   const tx = testPermissions.connect(siteAdmin).blacklistPublicRole(publicUser.address);
    //   await expect(tx).to.emit(testPermissions, "AccountBlacklisted").withArgs(publicUser.address);
    //   await (await tx).wait();
      
    //   // User should now be blacklisted
    //   expect(await testPermissions.isPublic(publicUser.address)).to.be.false;
    // });
    
    // it("Should allow site admin to restore previously blacklisted users", async function () {
    //   const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
    //   // Make siteAdmin a site admin
    //   await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
    //   // First blacklist the user
    //   await testPermissions.connect(siteAdmin).blacklistPublicRole(publicUser.address);
    //   expect(await testPermissions.isPublic(publicUser.address)).to.be.false;
      
    //   // Site admin should be able to restore the user
    //   await testPermissions.connect(siteAdmin).revokeRole(publicRole, publicUser.address);
    //   expect(await testPermissions.isPublic(publicUser.address)).to.be.true;
    // });
    
    it("Should not allow site admin to manage super admin roles", async function () {
      const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Make siteAdmin a site admin
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Site admin should not be able to grant super admin role
      await expect(testPermissions.connect(siteAdmin).grantRole(superAdminRole, publicUser.address))
        .to.be.reverted;
    });
    
    it("Should not allow site admin to remove super admin role from owner", async function () {
      const { testPermissions, owner, siteAdmin } = await loadFixture(deployTestPermissionsFixture);
      
      // Make siteAdmin a site admin
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Site admin should not be able to revoke super admin role from owner
      await expect(testPermissions.connect(siteAdmin).revokeRole(superAdminRole, owner.address))
        .to.be.reverted;
    });
  });

  describe("Resource Role Management", function () {
    it("Should allow site admin to create resource roles", async function () {
      const { testPermissions, owner, siteAdmin } = await loadFixture(deployTestPermissionsFixture);
      
      // Make siteAdmin a site admin
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Create a resource role
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ROLE"));
      const tx = testPermissions.connect(siteAdmin).createResourceRole(resourceRole);
      
      await expect(tx).to.emit(testPermissions, "ResourceRoleCreated").withArgs(resourceRole);
    });
    
    it("Should not allow non-site admins to create resource roles", async function () {
      const { testPermissions, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Create a resource role as regular user - should fail
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ROLE"));
      await expect(testPermissions.connect(publicUser).createResourceRole(resourceRole))
        .to.be.revertedWithCustomError(testPermissions, "AccessControlUnauthorizedAccount")
        .withArgs(publicUser.address, siteAdminRole);
    });
    
    it("Should not allow creating invalid roles (system roles)", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
        
      // Try to create SITE_ADMIN_ROLE - should fail
      await expect(testPermissions.connect(owner).createResourceRole(siteAdminRole))
        .to.be.revertedWithCustomError(testPermissions, "InvalidRole");
        
      // Try to create DEFAULT_ADMIN_ROLE - should fail
      await expect(testPermissions.connect(owner).createResourceRole(superAdminRole))
        .to.be.revertedWithCustomError(testPermissions, "InvalidRole");
    });
  });

  describe("Role Hierarchy and Inheritance", function () {
    it("Should recognize super admins as site admins automatically", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      // Owner is super admin by default
      expect(await testPermissions.hasRole(superAdminRole, owner.address)).to.be.true;
      
      // Should also have site admin capabilities
      expect(await testPermissions.isSiteAdmin(owner.address)).to.be.true;
      
      // But not directly assigned the site admin role
      expect(await testPermissions.hasRole(siteAdminRole, owner.address)).to.be.true;
    });
    
    it("Should maintain super admin powers even if site admin role is revoked", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      // Revoke site admin role from owner
      await testPermissions.connect(owner).revokeRole(siteAdminRole, owner.address);
      
      // Should still be super admin
      expect(await testPermissions.hasRole(superAdminRole, owner.address)).to.be.true;
      
      // Should still have site admin capabilities via inheritance
      expect(await testPermissions.isSiteAdmin(owner.address)).to.be.true;
    });
  });

//   describe("Public Role and Blacklisting", function () {
//     it("Should correctly implement the whitelist/blacklist functions", async function () {
//       const { testPermissions, owner, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
//       // User should be public (not blacklisted) by default
//       expect(await testPermissions.isPublic(publicUser.address)).to.be.true;
//       expect(await testPermissions.hasRole(publicRole, publicUser.address)).to.be.false;
      
//       // Blacklist the user
//       await testPermissions.connect(owner).blacklistPublicRole(publicUser.address);
      
//       // User should now be blacklisted
//       expect(await testPermissions.isPublic(publicUser.address)).to.be.false;
//       expect(await testPermissions.hasRole(publicRole, publicUser.address)).to.be.true;
      
//       // Whitelist the user
//       await testPermissions.connect(owner).whitelistPublicRole(publicUser.address);
      
//       // User should be public again
//       expect(await testPermissions.isPublic(publicUser.address)).to.be.true;
//       expect(await testPermissions.hasRole(publicRole, publicUser.address)).to.be.false;
//     });
    
//     it("Should properly enforce the onlyPublic modifier", async function () {
//       const { testPermissions, owner, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
//       // Set up a test function with onlyPublic modifier for testing
//       // Note: This would require you to add a test function in your contract
      
//       // Blacklist the user
//       await testPermissions.connect(owner).blacklistPublicRole(publicUser.address);
      
//     });
//   });

  describe("Events", function () {
    it("Should emit correct events when granting roles", async function () {
      const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Grant site admin role - should emit AdminRoleGranted
      await expect(testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address))
        .to.emit(testPermissions, "RoleGranted")
        .withArgs(siteAdminRole, siteAdmin.address, owner.address);

      // Create and grant a resource role - should emit ResourceRoleGranted
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_RESOURCE_ROLE"));
      await testPermissions.connect(owner).createResourceRole(resourceRole);
      
      await expect(testPermissions.connect(owner).grantRole(resourceRole, publicUser.address))
        .to.emit(testPermissions, "RoleGranted")
        .withArgs(resourceRole, publicUser.address, owner.address);
    });
    
    it("Should emit correct events when revoking roles", async function () {
      const { testPermissions, owner, siteAdmin, publicUser } = await loadFixture(deployTestPermissionsFixture);
      
      // Setup roles first
      await testPermissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_RESOURCE_ROLE"));
      await testPermissions.connect(owner).createResourceRole(resourceRole);
      await testPermissions.connect(owner).grantRole(resourceRole, publicUser.address);
      
      // Revoke site admin role - should emit AdminRoleRevoked
      await expect(testPermissions.connect(owner).revokeRole(siteAdminRole, siteAdmin.address))
        .to.emit(testPermissions, "RoleRevoked")
        .withArgs(siteAdminRole, siteAdmin.address, owner.address);
      
      // Revoke a resource role - should emit ResourceRoleRevoked
      await expect(testPermissions.connect(owner).revokeRole(resourceRole, publicUser.address))
        .to.emit(testPermissions, "RoleRevoked")
        .withArgs(resourceRole, publicUser.address, owner.address);
    });
  });

  describe("ValidRole Modifier", function () {
    it("Should validate custom roles", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      // Create a custom role (not one of the predefined roles)
      const customRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CUSTOM_ROLE"));
      
      // This should not revert as the role is not one of the predefined roles
      await expect(testPermissions.connect(owner).testValidRole(customRole))
        .to.not.be.reverted;
    });
    
    it("Should not validate predefined roles", async function () {
      const { testPermissions, owner } = await loadFixture(deployTestPermissionsFixture);
      
      // This should revert for predefined roles
      const superAdminRole = await testPermissions.getSuperAdminRole();
      const siteAdminRole = await testPermissions.getSiteAdminRole();
      
      await expect(testPermissions.connect(owner).testValidRole(superAdminRole))
        .to.be.reverted;
      await expect(testPermissions.connect(owner).testValidRole(siteAdminRole))
        .to.be.reverted;
    });
  });
});