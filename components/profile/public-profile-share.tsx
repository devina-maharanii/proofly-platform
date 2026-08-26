"use client";

/** Phase 20 style: small, calm sharing controls with clear feedback and no social mechanics. */
import { useState } from "react";

export function PublicProfileShare({
  profileUrl,
  profileName,
}: Readonly<{
  profileUrl: string;
  profileName: string;
}>) {
  const [message, setMessage] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setMessage("Public profile link copied.");
    } catch {
      setMessage(
        "Copy is unavailable in this browser. Use the profile address in the URL bar."
      );
    }
  }

  async function shareProfile() {
    if (typeof navigator.share !== "function") {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${profileName} | Proofly`,
        text: `Review ${profileName}'s public evidence profile on Proofly.`,
        url: profileUrl,
      });
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(
        "Sharing is unavailable in this browser. You can copy the profile link instead."
      );
    }
  }

  return (
    <div
      className="public-profile-share"
      aria-label="Share this public profile"
    >
      <button
        type="button"
        className="button button-secondary"
        onClick={copyLink}
      >
        Copy link
      </button>
      <button
        type="button"
        className="button button-primary"
        onClick={shareProfile}
      >
        Share profile
      </button>
      <p
        className="public-profile-share-status"
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
