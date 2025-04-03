// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::sync::mpsc;
use serde::{Deserialize, Serialize};
use std::process::Command;

use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioConfig {
    format: String,      // "mp3", "aac", "wav", "flac"
    bitrate: String,     // "128k", "320k", etc
    sample_rate: String, // "44100", "48000", etc
    channels: i32,       // 1 or 2
}

#[derive(Debug, Serialize, Deserialize)]
struct SongInfo {
    video_file: String,
    output_filename: String,
    title: String,
    artist: String,
    start_time: Option<String>,
    end_time: Option<String>,
    output_path: Option<String>,
    audio_config: AudioConfig,
    metadata: Option<AudioMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AudioMetadata {
    title: String,
    artist: String,
    album: Option<String>,
    year: Option<String>,
    genre: Option<String>,
    comment: Option<String>,
}

#[tauri::command]
async fn pick_file(app_handle: tauri::AppHandle) -> Option<String> {
    let (tx, rx) = mpsc::channel();
    
    app_handle.dialog()
        .file()
        .add_filter("Video", &["mp4", "mkv", "avi", "mov"]) // 添加 mov 格式支持
        .add_filter("Audio", &["mp3", "wav", "flac"])
        .pick_file(move |file_path| {
            if let Some(path) = file_path {
                tx.send(Some(path.to_string())).ok();
            } else {
                tx.send(None).ok();
            }
        });

    rx.recv().ok().flatten()
}

#[tauri::command]
async fn show_message_dialog(
    app_handle: tauri::AppHandle,
    message: String,
    title: String,
    kind: String
) -> bool {
    let dialog_kind = match kind.as_str() {
        "info" => MessageDialogKind::Info,
        "warning" => MessageDialogKind::Warning,
        "error" => MessageDialogKind::Error,
        _ => MessageDialogKind::Info,
    };

    app_handle.dialog()
        .message(message)
        .title(title)
        .kind(dialog_kind)
        .blocking_show()
}

#[tauri::command]
async fn save_file_dialog(app_handle: tauri::AppHandle) -> Option<String> {
    app_handle
        .dialog()
        .file()
        .add_filter("音频文件", &["mp3", "wav", "flac"])
        .blocking_save_file()
        .map(|path| path.to_string())
}

#[tauri::command]
async fn pick_output_dir(app_handle: tauri::AppHandle) -> Option<String> {
    let (tx, rx) = mpsc::channel();
    
    app_handle.dialog()
        .file()
        .pick_folder(move |folder_path| {
            if let Some(path) = folder_path {
                tx.send(Some(path.to_string())).ok();
            } else {
                tx.send(None).ok();
            }
        });

    rx.recv().ok().flatten()
}

#[tauri::command]
async fn convert_audio(_app_handle: tauri::AppHandle, song: SongInfo) -> Result<bool, String> {
    let output_path = if let Some(path) = song.output_path {
        path
    } else {
        song.output_filename
    };

    println!("开始转换音频...");
    println!("输入文件: {}", song.video_file);
    println!("输出路径: {}", output_path);

    // 检查输入文件是否存在
    if !std::path::Path::new(&song.video_file).exists() {
        return Err(format!("输入文件不存在: {}", song.video_file));
    }

    // 检查输出目录是否存在
    if let Some(parent) = std::path::Path::new(&output_path).parent() {
        if !parent.exists() {
            return Err(format!("输出目录不存在: {}", parent.display()));
        }
    }

    let ffmpeg_cmd = "/opt/homebrew/bin/ffmpeg";
    // 检查 ffmpeg 是否存在
    if !std::path::Path::new(ffmpeg_cmd).exists() {
        return Err(format!("FFmpeg不存在于路径: {}", ffmpeg_cmd));
    }

    let mut command = Command::new(ffmpeg_cmd);
    
    // 添加详细日志输出
    command.arg("-v").arg("info");
    
    command.arg("-i").arg(&song.video_file);

    if let Some(start) = song.start_time {
        command.arg("-ss").arg(start);
    }
    if let Some(end) = song.end_time {
        command.arg("-t").arg(end);
    }

    // 添加元数据参数
    command.args(&[
        "-metadata", &format!("title={}", song.title),
        "-metadata", &format!("artist={}", song.artist)
    ]);

    command.args(&[
        "-acodec", match song.audio_config.format.as_str() {
            "mp3" => "libmp3lame",
            "aac" => "aac",
            "flac" => "flac",
            _ => "copy",
        },
        "-ab", &song.audio_config.bitrate,
        "-ar", &song.audio_config.sample_rate,
        "-ac", &song.audio_config.channels.to_string(),
    ]);

    command.args(&["-y", &output_path]);

    println!("执行命令: {:?}", command);

    match command.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            println!("FFmpeg 标准输出: {}", stdout);
            println!("FFmpeg 错误输出: {}", stderr);

            if !output.status.success() {
                Err(format!("FFmpeg 执行失败: {}", stderr))
            } else {
                println!("转换成功!");
                Ok(true)
            }
        }
        Err(e) => {
            println!("命令执行错误: {}", e);
            Err(format!("执行命令失败: {}", e))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            pick_file,
            show_message_dialog,
            save_file_dialog,
            convert_audio,
            pick_output_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
