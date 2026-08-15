import { createServerFn } from "@tanstack/react-start";
import { askGateway, extractJson } from "./ai.server";

export const readIdCard = createServerFn({ method: "POST" })
  .inputValidator((data: { image: string; format?: string }) => {
    if (!data?.image?.startsWith("data:image/")) throw new Error("A photo of the ID card is required");
    return data;
  })
  .handler(async ({ data }) => {
    const hint = data.format
      ? `The roll number on this institution's IDs looks like: ${data.format}.`
      : "";
    const raw = await askGateway([
      {
        type: "text",
        text:
          "You are reading a student ID card photo. " +
          hint +
          ' Return ONLY strict JSON: {"roll_number": string|null, "name": string|null, "extra": string|null, "readable": boolean}. ' +
          "roll_number is the student's registration/roll/enrolment number exactly as printed (keep letters, digits and separators). " +
          "name is the student's full name. extra can hold the course/branch/year if printed. " +
          "Set readable=false when the picture is too blurry or is clearly not a student ID.",
      },
      { type: "image_url", image_url: { url: data.image } },
    ]);

    const parsed = extractJson<{
      roll_number: string | null;
      name: string | null;
      extra: string | null;
      readable: boolean;
    }>(raw);

    return {
      rollNumber: parsed.roll_number?.trim() ?? "",
      name: parsed.name?.trim() ?? "",
      extra: parsed.extra?.trim() ?? "",
      readable: parsed.readable !== false,
    };
  });

export const readRosterFile = createServerFn({ method: "POST" })
  .inputValidator((data: { file: string; filename: string }) => {
    if (!data?.file?.startsWith("data:")) throw new Error("A file is required");
    return data;
  })
  .handler(async ({ data }) => {
    const isPdf = data.file.startsWith("data:application/pdf");
    const instruction =
      "This document is a class list of students. Extract every student row. " +
      'Return ONLY strict JSON: {"students": [{"roll_number": string, "name": string|null}]}. ' +
      "Keep roll numbers exactly as printed. Skip headers, page numbers and totals. Never invent rows.";

    const raw = await askGateway([
      { type: "text", text: instruction },
      isPdf
        ? { type: "file", file: { filename: data.filename || "roster.pdf", file_data: data.file } }
        : { type: "image_url", image_url: { url: data.file } },
    ]);

    const parsed = extractJson<{ students: Array<{ roll_number: string; name: string | null }> }>(raw);
    const seen = new Set<string>();
    const students = (parsed.students ?? [])
      .map((s) => ({ roll_number: String(s.roll_number ?? "").trim(), name: s.name?.trim() ?? null }))
      .filter((s) => {
        if (!s.roll_number || seen.has(s.roll_number.toUpperCase())) return false;
        seen.add(s.roll_number.toUpperCase());
        return true;
      });

    return { students };
  });
