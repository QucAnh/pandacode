//! The agent's plan checklist, drawn in the sidebar while it works.
//! Decoration only: it never gates a tool, an approval or a task state.
use crate::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const MAX_ITEMS: usize = 40;
pub const MAX_TEXT: usize = 200;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub text: String,
    /// `pending`, `active` or `done`; unknown values are read as `pending`.
    pub status: String,
}

fn status(value: &str) -> &'static str {
    match value {
        "active" => "active",
        "done" => "done",
        _ => "pending",
    }
}

/// Reads the stored column; a damaged value reads as no plan rather than an error.
pub fn parse(stored: Option<String>) -> Vec<TodoItem> {
    let Some(stored) = stored else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<TodoItem>>(&stored)
        .map(|items| {
            items
                .into_iter()
                .filter_map(|item| {
                    let text = item.text.trim();
                    (!text.is_empty()).then(|| TodoItem {
                        text: text.chars().take(MAX_TEXT).collect(),
                        status: status(&item.status).into(),
                    })
                })
                .take(MAX_ITEMS)
                .collect()
        })
        .unwrap_or_default()
}

pub fn encode(items: &[TodoItem]) -> Result<String> {
    serde_json::to_string(items).map_err(|e| e.to_string())
}

/// Builds the list from tool arguments; the whole list is replaced on every call.
pub fn from_args(args: &Value) -> Result<Vec<TodoItem>> {
    let items = args["items"]
        .as_array()
        .ok_or("Provide the full plan as a list of items.")?;
    if items.len() > MAX_ITEMS {
        return Err(format!("Report at most {MAX_ITEMS} items."));
    }
    items
        .iter()
        .map(|item| {
            let text = item["text"].as_str().unwrap_or_default().trim();
            if text.is_empty() {
                return Err("Every plan item needs text.".into());
            }
            let status = item["status"].as_str().unwrap_or_default();
            if !matches!(status, "pending" | "active" | "done") {
                return Err("Plan item status must be pending, active or done.".into());
            }
            Ok(TodoItem {
                text: text.chars().take(MAX_TEXT).collect(),
                status: status.into(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn stored_lists_round_trip_and_damaged_values_read_as_empty() {
        let items = from_args(&json!({"items":[{"text":"Read the code","status":"done"},{"text":"Edit it","status":"active"}]})).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(parse(Some(encode(&items).unwrap())), items);
        assert!(parse(Some("not json".into())).is_empty());
        assert!(parse(None).is_empty());
    }

    #[test]
    fn unknown_status_reads_as_pending_and_blank_items_are_refused() {
        assert_eq!(parse(Some(r#"[{"text":"Check","status":"later"}]"#.into())).first().unwrap().status, "pending");
        assert!(from_args(&json!({"items":[{"text":"  ","status":"done"}]})).is_err());
        assert!(from_args(&json!({"items":[{"text":"x","status":"soon"}]})).is_err());
        let many = (0..MAX_ITEMS + 1).map(|i| json!({"text":format!("step {i}"),"status":"pending"})).collect::<Vec<_>>();
        assert!(from_args(&json!({"items":many})).is_err());
    }
}
