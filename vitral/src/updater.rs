//! Atualizações: procura versões novas publicadas no GitHub, baixa e troca o .exe.
//!
//! O repositório é privado, então o GitHub só responde com um token de leitura
//! (configurado pelo usuário em Configurações → Atualizações).

use std::path::PathBuf;

use serde_json::Value;

use crate::model::UpdateInfo;
use crate::settings::data_dir;

/// Repositório onde as versões do Vitral são publicadas (aba Releases).
pub const REPO: &str = "gabrieltrannin/vitral-spotify-client";
/// As versões usam tags no formato `v0.2.0` (também aceita `vitral-v0.2.0`).
pub const TAG_PREFIXES: &[&str] = &["vitral-v", "v"];

pub fn current_version() -> semver::Version {
    semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap_or_else(|_| semver::Version::new(0, 0, 0))
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!("Vitral/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_default()
}

fn with_token(req: reqwest::RequestBuilder, token: &str) -> reqwest::RequestBuilder {
    let token = token.trim();
    if token.is_empty() { req } else { req.bearer_auth(token) }
}

fn parse_tag(tag: &str) -> Option<semver::Version> {
    TAG_PREFIXES
        .iter()
        .find_map(|p| tag.strip_prefix(p))
        .and_then(|v| semver::Version::parse(v).ok())
}

/// Retorna a versão mais nova publicada, se for maior que a instalada.
pub async fn check(token: &str) -> Result<Option<UpdateInfo>, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases?per_page=30");
    let resp = with_token(client().get(&url), token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("Sem conexão pra procurar atualização: {e}"))?;
    match resp.status().as_u16() {
        200 => {}
        401 => return Err("O token do GitHub não é válido ou expirou. Gere outro em Configurações → Atualizações.".into()),
        403 | 404 if token.trim().is_empty() => {
            return Err("O repositório é privado: cole um token do GitHub em Configurações → Atualizações.".into());
        }
        403 | 404 => return Err("O token não tem acesso ao repositório do Vitral (precisa de Contents: leitura).".into()),
        code => return Err(format!("O GitHub respondeu {code}")),
    }
    let list: Value = resp.json().await.map_err(|e| e.to_string())?;
    let current = current_version();
    let mut best: Option<(semver::Version, UpdateInfo)> = None;
    for rel in list.as_array().into_iter().flatten() {
        if rel["draft"].as_bool() == Some(true) || rel["prerelease"].as_bool() == Some(true) {
            continue;
        }
        let Some(ver) = rel["tag_name"].as_str().and_then(parse_tag) else { continue };
        if ver <= current {
            continue;
        }
        let asset = rel["assets"].as_array().into_iter().flatten().find(|a| {
            a["name"].as_str().map(|n| n.to_lowercase().ends_with(".exe")).unwrap_or(false)
        });
        let Some(asset) = asset else { continue };
        let info = UpdateInfo {
            version: ver.to_string(),
            notes: rel["body"].as_str().unwrap_or("").trim().to_string(),
            url: asset["url"].as_str().unwrap_or("").to_string(),
        };
        if best.as_ref().map(|(b, _)| ver > *b).unwrap_or(true) {
            best = Some((ver, info));
        }
    }
    Ok(best.map(|(_, info)| info))
}

/// Baixa o novo .exe, avisando o progresso (0.0 a 1.0).
pub async fn download(info: &UpdateInfo, token: &str, mut progress: impl FnMut(f32)) -> Result<PathBuf, String> {
    let dir = data_dir().join("update");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("Vitral-{}.exe", info.version));
    // `info.url` é o endereço do anexo na API; com este cabeçalho o GitHub entrega o arquivo.
    let mut resp = with_token(client().get(&info.url), token)
        .header("Accept", "application/octet-stream")
        .send()
        .await
        .map_err(|e| format!("Não consegui baixar a atualização: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("O download respondeu {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0) as f32;
    let mut bytes: Vec<u8> = Vec::with_capacity(total as usize);
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("O download caiu: {e}"))? {
        bytes.extend_from_slice(&chunk);
        if total > 0.0 {
            progress((bytes.len() as f32 / total).min(1.0));
        }
    }
    if bytes.len() < 1_000_000 || !bytes.starts_with(b"MZ") {
        return Err("O arquivo baixado não parece um programa do Windows.".into());
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("Não consegui salvar a atualização: {e}"))?;
    Ok(path)
}

/// Troca o programa pelo novo e abre de novo.
pub fn install_and_restart(path: &PathBuf) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("A troca automática só funciona no Windows.".into());
    }
    self_replace::self_replace(path).map_err(|e| format!("Não consegui instalar: {e}"))?;
    let _ = std::fs::remove_file(path);
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    std::process::Command::new(exe).spawn().map_err(|e| format!("Não consegui reabrir: {e}"))?;
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_tags() {
        assert_eq!(parse_tag("v0.2.0"), Some(semver::Version::new(0, 2, 0)));
        assert_eq!(parse_tag("vitral-v1.3.4"), Some(semver::Version::new(1, 3, 4)));
        assert_eq!(parse_tag("release-1"), None);
    }
}
