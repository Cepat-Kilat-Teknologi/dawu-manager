import { describe, it, expect } from "vitest";
import {
  mainNavItems,
  nodeNavItems,
  nodeNavSections,
  type NavSection,
  type NavItem,
  type NodeNavSection,
} from "@/config/navigation";

describe("navigation config", () => {
  describe("mainNavItems", () => {
    it("has Overview and Management sections", () => {
      const titles = mainNavItems.map((s: NavSection) => s.title);
      expect(titles).toContain("Overview");
      expect(titles).toContain("Management");
    });

    it("Overview section has Dashboard and Nodes", () => {
      const overview = mainNavItems.find(
        (s: NavSection) => s.title === "Overview",
      )!;
      const titles = overview.items.map((i: NavItem) => i.title);
      expect(titles).toContain("Dashboard");
      expect(titles).toContain("Nodes");
    });

    it("Management section items require admin role", () => {
      const mgmt = mainNavItems.find(
        (s: NavSection) => s.title === "Management",
      )!;
      mgmt.items.forEach((item: NavItem) => {
        expect(item.roles).toContain("admin");
      });
    });

    it("Dashboard links to /", () => {
      const overview = mainNavItems.find(
        (s: NavSection) => s.title === "Overview",
      )!;
      const dashboard = overview.items.find(
        (i: NavItem) => i.title === "Dashboard",
      )!;
      expect(dashboard.href).toBe("/");
    });

    it("all items have icon and href", () => {
      mainNavItems.forEach((section: NavSection) => {
        section.items.forEach((item: NavItem) => {
          expect(item.icon).toBeDefined();
          expect(typeof item.href).toBe("string");
        });
      });
    });
  });

  describe("nodeNavSections", () => {
    it("has General, Network, Services, and System sections", () => {
      const titles = nodeNavSections.map((s: NodeNavSection) => s.title);
      expect(titles).toEqual(["General", "Network", "Services", "System"]);
    });

    it("each section has at least 2 items", () => {
      nodeNavSections.forEach((section: NodeNavSection) => {
        expect(section.items.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("nodeNavItems", () => {
    it("has 16 navigation items from all sections", () => {
      expect(nodeNavItems).toHaveLength(16);
    });

    it("equals the flat list of all section items", () => {
      const flat = nodeNavSections.flatMap((s: NodeNavSection) => s.items);
      expect(nodeNavItems).toEqual(flat);
    });

    it("includes expected pages", () => {
      const titles = nodeNavItems.map((i: NavItem) => i.title);
      expect(titles).toContain("Overview");
      expect(titles).toContain("Sessions");
      expect(titles).toContain("Firewall");
      expect(titles).toContain("Network");
      expect(titles).toContain("Config");
      expect(titles).toContain("PPPoE");
      expect(titles).toContain("DHCP");
      expect(titles).toContain("Routing");
      expect(titles).toContain("IP Pool");
      expect(titles).toContain("System");
      expect(titles).toContain("Diagnostics");
      expect(titles).toContain("Events");
      expect(titles).toContain("Monitoring");
      expect(titles).toContain("Logs");
    });

    it("Overview has empty href (relative)", () => {
      const overview = nodeNavItems.find(
        (i: NavItem) => i.title === "Overview",
      )!;
      expect(overview.href).toBe("");
    });

    it("all items have icon", () => {
      nodeNavItems.forEach((item: NavItem) => {
        expect(item.icon).toBeDefined();
      });
    });
  });
});
