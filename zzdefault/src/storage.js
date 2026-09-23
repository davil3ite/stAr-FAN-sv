// storage.js

import supabase from "./supabase.js";

// Nome do bucket criado no Storage do Supabase.
export const BUCKET = "article-images";

// Tamanho máximo por imagem, em MB. O mesmo limite está no bucket.
const MAX_MB = 5;

function fileExtension(file) {
  const fromName = file.name?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  const fromType = file.type?.split("/")[1];
  return fromType || "jpg";
}

// Confere o arquivo antes de subir. Devolve { ok } ou { ok: false, error }.
export function checkImage(file) {
  if (!file) return { ok: false, error: "Escolha uma imagem." };
  if (!file.type?.startsWith("image/")) return { ok: false, error: "O arquivo precisa ser uma imagem." };
  if (file.size > MAX_MB * 1024 * 1024) return { ok: false, error: `A imagem precisa ter menos de ${MAX_MB} MB.` };
  return { ok: true };
}

// Sobe a imagem e devolve { ok, url } ou { ok: false, error }.
// O nome do arquivo é sorteado, então dois envios nunca se sobrescrevem.
export async function uploadImage(file, folder = "covers") {
  const check = checkImage(file);
  if (!check.ok) return check;

  const path = `${folder}/${crypto.randomUUID()}.${fileExtension(file)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente de novo." };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}