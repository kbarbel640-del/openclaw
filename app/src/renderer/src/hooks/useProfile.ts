import { useState, useEffect, useCallback } from "react";
import { useIPCInvoke } from "./useIPC";

export interface ScenarioEntry {
  name: string;
  sampleCount: number;
  confidence: "high" | "good" | "moderate" | "low";
}

export interface ProfileData {
  totalPhotos: number;
  scenarioCount: number;
  scenarios: ScenarioEntry[];
  signatureMoves: Array<{ slider: string; description: string }>;
  correlations: Array<{ pair: string; r: number }>;
  scenarioProfiles: Array<{
    name: string;
    sampleCount: number;
    adjustments: Array<{ slider: string; median: number; deviation: number }>;
  }>;
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const invoke = useIPCInvoke();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    const data = await invoke<ProfileData>("profile:get");
    if (data) {
      setProfile(data);
    }
    setLoading(false);
  }, [invoke]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    refresh: fetchProfile,
  };
}
