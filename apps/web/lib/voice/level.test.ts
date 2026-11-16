import { describe, expect, it } from "vitest";
import { bandEdges, bandLevels } from "./level";

describe("bandEdges", () => {
  it("spreads bands logarithmically across the voice range", () => {
    const edges = bandEdges(5);
    expect(edges).toHaveLength(6);
    expect(edges[0]).toBeCloseTo(120);
    expect(edges[5]).toBeCloseTo(4000);
    for (let i = 1; i < edges.length; i++) expect(edges[i]!).toBeGreaterThan(edges[i - 1]!);
    // Equal ratios: every band is the same musical width.
    expect(edges[2]! / edges[1]!).toBeCloseTo(edges[1]! / edges[0]!);
  });

  it("always returns at least one band", () => {
    expect(bandEdges(0)).toHaveLength(2);
  });
});

describe("bandLevels", () => {
  const sampleRate = 48_000;
  const bins = 512; // fftSize 1024: 46.875 Hz per bin

  it("is 0 in silence and 1 at full scale", () => {
    const edges = bandEdges(4);
    expect(bandLevels(new Uint8Array(bins), sampleRate, edges)).toEqual([0, 0, 0, 0]);
    expect(bandLevels(new Uint8Array(bins).fill(255), sampleRate, edges)).toEqual([1, 1, 1, 1]);
  });

  it("only lights the band a tone falls in", () => {
    const data = new Uint8Array(bins);
    data[Math.floor(3000 / 46.875)] = 255; // a 3 kHz tone
    const levels = bandLevels(data, sampleRate, [120, 1000, 2000, 5000]);
    expect(levels[0]).toBe(0);
    expect(levels[1]).toBe(0);
    expect(levels[2]).toBeGreaterThan(0);
  });

  it("averages the bins of each band", () => {
    const data = new Uint8Array(bins).fill(0);
    data.fill(102, 3, 6); // bins 3–5 (140.6–281.2 Hz) at 40%
    const [low] = bandLevels(data, sampleRate, [141, 281]);
    expect(low).toBeCloseTo(0.4);
  });

  it("copes with no data", () => {
    expect(bandLevels([], sampleRate, [100, 200, 300])).toEqual([0, 0]);
  });
});
