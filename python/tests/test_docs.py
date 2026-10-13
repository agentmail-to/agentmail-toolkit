"""Tool docs floor: what an agent reads to pick a tool and fill its arguments.

A field documented only by its own name ("ID of inbox" for inbox_id, "Subject" for
subject) tells an agent nothing: not what the value is, not where to get it. These
checks are the floor, not the standard; they catch a field added with no real docs.
The length cap keeps every description inside Claude Code's 2 KB field.
"""

import re

import pytest

from agentmail_toolkit.tools import tools

MAX_DESCRIPTION_CHARS = 1800
FILLER = {"id", "of", "the", "a", "an", "for", "to"}


def words(text):
    return [word for word in re.split(r"[^a-z0-9]+", text.lower()) if word]


def restates_name(name, description):
    """True when a description adds nothing to the name it documents."""
    own = set(words(name.replace("_", " "))) | FILLER
    return all(word in own for word in words(description))


def named_properties(schema, defs, path=""):
    """Every named property in a JSON Schema, following $refs and descending into arrays and unions."""
    if "$ref" in schema:
        schema = defs[schema["$ref"].split("/")[-1]]
    found = []
    for name, child in schema.get("properties", {}).items():
        child_path = f"{path}.{name}" if path else name
        found.append((child_path, name, child.get("description")))
        found.extend(named_properties(child, defs, child_path))
    if isinstance(schema.get("items"), dict):
        found.extend(named_properties(schema["items"], defs, path))
    for key in ("anyOf", "oneOf", "allOf"):
        for child in schema.get(key, []):
            found.extend(named_properties(child, defs, path))
    return found


@pytest.mark.parametrize("tool", tools, ids=lambda tool: tool.name)
def test_tool_description_says_more_than_its_name(tool):
    assert not restates_name(tool.name, tool.description), tool.description
    assert len(tool.description) <= MAX_DESCRIPTION_CHARS


@pytest.mark.parametrize("tool", tools, ids=lambda tool: tool.name)
def test_every_input_field_is_documented_beyond_its_name(tool):
    schema = tool.params_schema.model_json_schema()
    thin = [
        f"{path}: {description!r}"
        for path, name, description in named_properties(schema, schema.get("$defs", {}))
        if not description or restates_name(name, description)
    ]
    assert thin == []
