import assert from "node:assert/strict";
import test from "node:test";
import { VIEW_LANDING, activeLink, otherView, viewingAs } from "./viewingAs.ts";

const seeker = { canOfferServices: true, hasCompany: false };
const seekerWithSeat = { canOfferServices: true, hasCompany: true };
const employer = { canOfferServices: false, hasCompany: true };

test("someone with no company starts as a freelancer", () => {
  assert.equal(viewingAs(null, seeker), "freelancer");
});

test("someone with a company starts as a client", () => {
  assert.equal(viewingAs(null, seekerWithSeat), "client");
});

test("a choice made outlasts the default", () => {
  assert.equal(viewingAs("client", seeker), "client");
  assert.equal(viewingAs("freelancer", seekerWithSeat), "freelancer");
});

test("an account that can't offer services stays a client, even with a choice stored", () => {
  assert.equal(viewingAs("freelancer", employer), "client");
  assert.equal(viewingAs(null, { canOfferServices: false, hasCompany: false }), "client");
});

test("anything else in storage is ignored", () => {
  assert.equal(viewingAs("admin", seeker), "freelancer");
});

const clientLinks = ["/providers", "/providers/saved", "/services", "/marketplace/manage?kind=project", "/marketplace/inbox?box=outgoing"];
const freelancerLinks = ["/provider", "/marketplace/manage?kind=service", "/marketplace/inbox?box=incoming"];

test("the most specific link lights, and a professional's page lights the directory", () => {
  assert.equal(activeLink(clientLinks, "/providers", ""), "/providers");
  assert.equal(activeLink(clientLinks, "/providers/saved", ""), "/providers/saved");
  assert.equal(activeLink(clientLinks, "/providers/some-id", ""), "/providers");
  assert.equal(activeLink(clientLinks, "/services/some-id", ""), "/services");
});

test("/provider is not /providers", () => {
  assert.equal(activeLink(freelancerLinks, "/provider", ""), "/provider");
  assert.equal(activeLink(freelancerLinks, "/providers", ""), null);
});

test("the listing kind and inbox folder have to match, as the page reads them", () => {
  assert.equal(activeLink(clientLinks, "/marketplace/manage", "?kind=project"), "/marketplace/manage?kind=project");
  // With no ?kind= the page shows services, so the client's project row stays dark.
  assert.equal(activeLink(clientLinks, "/marketplace/manage", ""), null);
  assert.equal(activeLink(freelancerLinks, "/marketplace/manage", ""), "/marketplace/manage?kind=service");
  assert.equal(activeLink(clientLinks, "/marketplace/inbox", "?box=outgoing&page=2"), "/marketplace/inbox?box=outgoing");
  assert.equal(activeLink(freelancerLinks, "/marketplace/inbox", ""), "/marketplace/inbox?box=incoming");
  assert.equal(activeLink(freelancerLinks, "/marketplace/inbox", "?box=outgoing"), null);
});

test("nothing lights on a page outside the links", () => {
  assert.equal(activeLink(clientLinks, "/community", ""), null);
});

test("switching lands on the tab that side came for", () => {
  assert.equal(otherView("freelancer"), "client");
  assert.equal(VIEW_LANDING[otherView("freelancer")], "/community?view=showcase");
  assert.equal(VIEW_LANDING[otherView("client")], "/community?view=opportunity");
});
