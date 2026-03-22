"""
tests/test_parsers.py — Tests the actual parsing logic (no mocks).
Run:  pytest tests/test_parsers.py -v
"""
import pytest
from parsers import parse_source_file, parse_folder
from schema import SourceLanguage, CodeEntity


CPP = """\
#include <vector>

class Sorter {
public:
    void bubbleSort(std::vector<int>& arr) {
        int n = arr.size();
        for (int i = 0; i < n-1; i++)
            for (int j = 0; j < n-i-1; j++)
                if (arr[j] > arr[j+1]) std::swap(arr[j], arr[j+1]);
    }
    int linearSearch(std::vector<int>& arr, int target) {
        for (int i = 0; i < arr.size(); i++)
            if (arr[i] == target) return i;
        return -1;
    }
};
"""

JAVA = """\
import java.util.ArrayList;

/** Fibonacci sequence generator. */
public class Fibonacci {
    private ArrayList<Long> memo = new ArrayList<>();
    public Fibonacci() { memo.add(0L); memo.add(1L); }
    public long compute(int n) {
        if (n < memo.size()) return memo.get(n);
        long r = compute(n-1) + compute(n-2);
        memo.add(r); return r;
    }
}
"""

EMPTY = ""


# ── Parse output type ──────────────────────────────────────────────────────────

def test_cpp_parse_returns_list():
    result = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    assert isinstance(result, list)
    assert len(result) >= 1


def test_java_parse_returns_list():
    result = parse_source_file("Test.java", JAVA, SourceLanguage.JAVA)
    assert isinstance(result, list)
    assert len(result) >= 1


def test_all_results_are_code_entities():
    for lang, code, path in [
        (SourceLanguage.CPP, CPP, "test.cpp"),
        (SourceLanguage.JAVA, JAVA, "Test.java"),
    ]:
        for entity in parse_source_file(path, code, lang):
            assert isinstance(entity, CodeEntity)


# ── Entity fields ─────────────────────────────────────────────────────────────

def test_entity_has_entity_id():
    entities = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    for e in entities:
        assert e.entity_id, "entity_id must be non-empty"
        assert len(e.entity_id) == 16, "SHA-256 prefix should be 16 chars"


def test_entity_has_name():
    entities = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    for e in entities:
        assert e.name, "name must be non-empty"


def test_entity_language_matches():
    cpp_entities  = parse_source_file("test.cpp",  CPP,  SourceLanguage.CPP)
    java_entities = parse_source_file("Test.java", JAVA, SourceLanguage.JAVA)
    for e in cpp_entities:
        assert e.language == SourceLanguage.CPP
    for e in java_entities:
        assert e.language == SourceLanguage.JAVA


def test_entity_file_path_preserved():
    entities = parse_source_file("some/path/Sorter.cpp", CPP, SourceLanguage.CPP)
    for e in entities:
        assert e.file_path == "some/path/Sorter.cpp"


def test_entity_has_source_code():
    entities = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    for e in entities:
        assert len(e.source_code) > 0


def test_entity_type_valid():
    valid_types = {"function", "class", "module", "external"}
    for lang, code, path in [
        (SourceLanguage.CPP,  CPP,  "test.cpp"),
        (SourceLanguage.JAVA, JAVA, "Test.java"),
    ]:
        for e in parse_source_file(path, code, lang):
            assert e.entity_type in valid_types, f"Unknown entity_type: {e.entity_type}"


def test_entity_ids_unique():
    entities = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    ids = [e.entity_id for e in entities]
    assert len(ids) == len(set(ids)), "entity_ids must be unique"


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_empty_file_returns_module_fallback():
    """Empty files should not crash — fallback to a module-level entity."""
    entities = parse_source_file("empty.cpp", EMPTY, SourceLanguage.CPP)
    assert len(entities) >= 1
    assert entities[0].entity_type == "module"


def test_single_function_cpp():
    src = "int add(int a, int b) { return a + b; }"
    entities = parse_source_file("add.cpp", src, SourceLanguage.CPP)
    assert len(entities) >= 1


def test_single_function_java():
    src = "public class Util { public static int add(int a, int b) { return a+b; } }"
    entities = parse_source_file("Util.java", src, SourceLanguage.JAVA)
    assert len(entities) >= 1


def test_dependencies_is_list():
    entities = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    for e in entities:
        assert isinstance(e.dependencies, list)


def test_model_dump_serialisable():
    """Entity must be JSON-serialisable (needed for AgentState)."""
    import json
    entities = parse_source_file("test.cpp", CPP, SourceLanguage.CPP)
    for e in entities:
        dumped = e.model_dump()
        # Should not raise
        json.dumps(dumped)


# ── Folder parsing ────────────────────────────────────────────────────────────

def test_parse_folder_nonexistent_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        parse_folder(str(tmp_path / "does_not_exist"))


def test_parse_folder_empty_dir(tmp_path):
    result = parse_folder(str(tmp_path))
    assert result == []


def test_parse_folder_finds_cpp(tmp_path):
    (tmp_path / "sorter.cpp").write_text(CPP)
    result = parse_folder(str(tmp_path))
    assert len(result) >= 1
    assert all(e.language == SourceLanguage.CPP for e in result)


def test_parse_folder_finds_java(tmp_path):
    (tmp_path / "Fib.java").write_text(JAVA)
    result = parse_folder(str(tmp_path))
    assert len(result) >= 1
    assert all(e.language == SourceLanguage.JAVA for e in result)


def test_parse_folder_mixed_languages(tmp_path):
    (tmp_path / "sorter.cpp").write_text(CPP)
    (tmp_path / "Fib.java").write_text(JAVA)
    result = parse_folder(str(tmp_path))
    langs = {e.language for e in result}
    assert SourceLanguage.CPP  in langs
    assert SourceLanguage.JAVA in langs
