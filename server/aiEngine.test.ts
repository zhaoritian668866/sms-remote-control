import { describe, it, expect } from "vitest";
import { filterBannedWords } from "./aiEngine";

describe("AI Engine - Banned Words Filter", () => {
  it("should replace banned words with asterisks", () => {
    const config = {
      bannedWords: ["赌博", "色情", "诈骗"],
      replacements: {},
    };
    const result = filterBannedWords("这是一个赌博网站", config);
    expect(result).toBe("这是一个**网站");
    expect(result).not.toContain("赌博");
  });

  it("should apply explicit replacements", () => {
    const config = {
      bannedWords: ["微信"],
      replacements: { "微信": "VX" },
    };
    const result = filterBannedWords("请加我微信聊天", config);
    expect(result).toBe("请加我VX聊天");
  });

  it("should handle multiple banned words", () => {
    const config = {
      bannedWords: ["赌博", "色情"],
      replacements: {},
    };
    const result = filterBannedWords("赌博和色情都是违法的", config);
    expect(result).not.toContain("赌博");
    expect(result).not.toContain("色情");
  });

  it("should be case insensitive", () => {
    const config = {
      bannedWords: ["WeChat"],
      replacements: {},
    };
    const result = filterBannedWords("Please add me on wechat", config);
    expect(result).not.toContain("wechat");
  });

  it("should return original text when no banned words", () => {
    const config = {
      bannedWords: [],
      replacements: {},
    };
    const result = filterBannedWords("正常的聊天内容", config);
    expect(result).toBe("正常的聊天内容");
  });

  it("should handle empty text", () => {
    const config = {
      bannedWords: ["test"],
      replacements: {},
    };
    const result = filterBannedWords("", config);
    expect(result).toBe("");
  });

  it("should prioritize explicit replacements over asterisks", () => {
    const config = {
      bannedWords: ["Telegram", "WhatsApp"],
      replacements: { "Telegram": "TG", "WhatsApp": "WA" },
    };
    const result = filterBannedWords("请加我Telegram或WhatsApp", config);
    expect(result).toBe("请加我TG或WA");
  });

  it("should replace all occurrences of a banned word", () => {
    const config = {
      bannedWords: ["赌博"],
      replacements: {},
    };
    const result = filterBannedWords("赌博不好，远离赌博", config);
    expect(result).not.toContain("赌博");
    expect(result).toBe("**不好，远离**");
  });
});

describe("AI Engine - Route Structure", () => {
  it("should export generateAiReply function", async () => {
    const { generateAiReply } = await import("./aiEngine");
    expect(typeof generateAiReply).toBe("function");
  });

  it("should export testAiConnection function", async () => {
    const { testAiConnection } = await import("./aiEngine");
    expect(typeof testAiConnection).toBe("function");
  });

  it("should export filterBannedWords function", async () => {
    const { filterBannedWords } = await import("./aiEngine");
    expect(typeof filterBannedWords).toBe("function");
  });
});
