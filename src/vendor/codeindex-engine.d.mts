declare const ENGINE_VERSION = "2.31.2";
declare const SCHEMA_VERSION = 5;
declare const EXTRACTOR_VERSION = 15;
type FileKind = "code" | "doc" | "config" | "asset" | "other";
type EdgeKind = "contains" | "doc-link" | "import" | "call" | "extends" | "implements" | "use" | "mention";
type Tier = 0 | 1 | 2;
interface CodeSymbol {
    name: string;
    kind: string;
    file: string;
    line: number;
    endLine?: number;
    parent?: string;
    parentPath?: string;
    signature?: string;
    doc?: string;
    exported: boolean;
    lang: string;
}
interface RawRef {
    kind: "doc-link" | "import";
    spec: string;
    /** Speculative ref: an edge when it resolves to an in-repo file, otherwise dropped silently (never external, never dangling). */
    soft?: true;
}
interface CodeLiteral {
    value: string;
    line: number;
    kind: "string" | "number" | "regex";
}
interface LiteralSite {
    file: string;
    line: number;
    holder?: string;
    holderExported?: boolean;
}
interface LiteralDuplication {
    value: string;
    kind: CodeLiteral["kind"];
    tier: "uncentralized" | "bypassed" | "competing";
    holders: LiteralSite[];
    literals: LiteralSite[];
    files: number;
    count: number;
}
interface RawRelation {
    kind: "extends" | "implements";
    from: string;
    to: string;
    line: number;
}
interface ImportAlias {
    local: string;
    name: string;
    from?: string;
}
interface FileRecord {
    rel: string;
    ext: string;
    size: number;
    lines: number;
    hash: string;
    kind: FileKind;
    lang: string;
    title?: string;
    summary?: string;
    headings: string[];
    symbols: CodeSymbol[];
    refs: RawRef[];
    pkg?: string;
    idents?: string[];
    calls?: {
        name: string;
        line: number;
        receiver?: string;
    }[];
    importedNames?: string[];
    importAliases?: ImportAlias[];
    truncated?: true;
    generated?: "minified" | "bundle";
    relations?: RawRelation[];
    terms?: string[];
    literals?: CodeLiteral[];
}
interface FileNode {
    id: string;
    kind: "file";
    rel: string;
    fileKind: FileKind;
    lang: string;
    module: string;
    title?: string;
    summary?: string;
    symbols: number;
    lines: number;
    degIn: number;
    degOut: number;
    pagerank?: number;
    testFile?: true;
    generated?: "minified" | "bundle";
}
interface ModuleNode {
    id: string;
    kind: "module";
    slug: string;
    path: string;
    title: string;
    summary: string;
    tier: Tier;
    members: string[];
    symbols: number;
    degIn: number;
    degOut: number;
    community?: number;
    pagerank?: number;
    betweenness?: number;
    testedBy?: string[];
}
interface Edge {
    from: string;
    to: string;
    kind: EdgeKind;
    weight: number;
    dangling?: boolean;
    reason?: string;
    confidence?: "extracted" | "inferred";
}
interface Graph {
    schemaVersion: number;
    version: string;
    commit?: string;
    fileCount: number;
    languages: Record<string, number>;
    files: FileNode[];
    modules: ModuleNode[];
    fileEdges: Edge[];
    moduleEdges: Edge[];
    surprises?: SurpriseEdge[];
    literalDuplications?: LiteralDuplication[];
}
interface SurpriseEdge {
    from: string;
    to: string;
    kind: EdgeKind;
    weight: number;
    communities: [number, number];
    pairEdges: number;
}
interface SymbolIndex {
    schemaVersion: number;
    defs: Record<string, {
        file: string;
        line: number;
        endLine?: number;
        kind: string;
        exported: boolean;
        lang: string;
        parent?: string;
    }[]>;
    refs: Record<string, string[]>;
}

type Encoding = 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be' | 'latin1';
interface TextRead {
    /** Decoded text. Empty string when `ok` is false or the file is genuinely empty. */
    text: string;
    /** Raw bytes as read. Byte offsets in the inventory index into THIS buffer. */
    buf: Uint8Array;
    encoding: Encoding | null;
    /** True when a NUL byte was found outside a BOM-declared UTF-16 file. */
    binary: boolean;
    bytes: number;
    /** False when the file could not be read (vanished, permissions, EISDIR). */
    ok: boolean;
    /**
     * Whether byte offsets computed from `text` address `buf` directly.
     *
     * True for utf8 and utf8-bom (the BOM is stripped from `text`, so offsets
     * carry a +3 shift the caller must apply via `bodyStart`). False for UTF-16
     * and latin1, where a decoded-string offset is not a file-byte offset. Those
     * files are still inventoried, but `apply` refuses to patch them rather than
     * writing at a plausible-looking wrong offset.
     */
    byteAddressable: boolean;
    /** Offset in `buf` at which `text` begins — 3 for utf8-bom, 2 for UTF-16, else 0. */
    bodyStart: number;
}
declare function readTextEx(abs: string): TextRead;
/**
 * Maps between JS string indices (UTF-16 code units) and UTF-8 byte offsets.
 *
 * Tree-sitter reports byte offsets; the hand-written lexers scan JS strings.
 * Both feed one inventory, so exactly one coordinate system can survive, and it
 * has to be bytes — that is what the patcher writes at. Getting this wrong is
 * silent corruption on any file containing an accented character or an emoji,
 * which for this tool is most of them.
 *
 * Pure-ASCII files take the identity fast path and allocate nothing, which is
 * the overwhelmingly common case.
 */
declare class OffsetMap {
    private readonly text;
    private readonly ascii;
    /** charToByteTable[i] = byte offset of char index i. Length = text.length + 1. */
    private readonly table;
    private readonly lineStarts;
    constructor(text: string);
    /** UTF-8 byte offset of a JS string index. */
    byteOf(charIndex: number): number;
    /** 1-based line and 1-based column (in UTF-16 code units, matching editors). */
    lineColOf(charIndex: number): {
        line: number;
        col: number;
    };
    get lineCount(): number;
}

declare const IGNORE_DIRS: Set<string>;
declare const LOCKFILES: Set<string>;
declare const BINARY_EXT: Set<string>;
/** An observed exclusion. Directory contents are not enumerated. */
interface WalkSkip {
    rel: string;
    reason: "binary-ext" | "lockfile" | "over-max-bytes" | "gitignored" | "minified" | "symlink-outside-root" | "broken-symlink" | "directory-symlink" | "file-symlink" | "ignore-dir" | "nested-repo" | "filter" | "unreadable";
    directory: boolean;
    size?: number;
    /** For "gitignored": the rule that decided it — its file, 1-based line, and pattern as written. */
    rule?: {
        source: string;
        line: number;
        pattern: string;
    };
}
interface WalkEntry {
    rel: string;
    abs: string;
    directory: boolean;
}
interface WalkOptions {
    maxFileBytes?: number;
    maxFiles?: number;
    gitignore?: boolean;
    ignoreDirs?: string[];
    /** Inventory modes opt in; source indexing retains its existing defaults. */
    includeLockfiles?: boolean;
    includeBinary?: boolean;
    includeOversize?: boolean;
    includeMinified?: boolean;
    /** Keep in-repo FILE symlinks as files of their own (skipped by default — see walk). */
    includeFileSymlinks?: boolean;
    trackedBuildDirs?: boolean;
    /** Replace the binary extension policy, e.g. to retain textual SVG. */
    binaryExtensions?: ReadonlySet<string>;
    /** Called before entering a directory or accepting a file. False prunes it. */
    filter?: (entry: WalkEntry) => boolean;
    /** Observe exclusions without retaining a second inventory in memory. */
    onSkip?: (entry: WalkSkip) => void;
}
interface WalkedFile {
    rel: string;
    abs: string;
    size: number;
    ext: string;
    mtimeMs: number;
}
interface WalkResult {
    files: WalkedFile[];
    capped: boolean;
    excluded: number;
}
declare const DEFAULT_MAX_FILES = 20000;
declare function walk(root: string, opts?: WalkOptions): WalkResult;
/** Compatibility reader; use readTextEx when empty, binary and unreadable differ. */
declare function readText(abs: string): string;

interface RepoScan {
    root: string;
    commit?: string;
    files: FileRecord[];
    languages: Record<string, number>;
    docText: Map<string, string>;
    mtimes: Map<string, number>;
    capped: boolean;
    excluded: number;
    contentUnchanged: boolean;
    cacheDirty: boolean;
}
interface ScanOptions {
    include?: string[];
    exclude?: string[];
    scope?: string;
    gitignore?: boolean;
    ignoreDirs?: string[];
    maxBytes?: number;
    maxFiles?: number;
    maxCallsPerFile?: number;
    out?: string;
    cache?: Map<string, {
        hash: string;
        record: FileRecord;
        size?: number;
        mtimeMs?: number;
    }>;
    fullHash?: boolean;
    precomputedWalk?: WalkResult;
    extracted?: Map<string, ExtractedRecord>;
    onSkip?: (skip: ScanSkip) => void;
}
type ScanSkip = WalkSkip | {
    rel: string;
    reason: "index-output";
    directory: false;
    size: number;
};
interface ExtractedRecord {
    size: number;
    mtimeMs: number;
    hash: string;
    record?: FileRecord;
}
declare function buildCodeRecord(rel: string, ext: string, size: number, content: string, hash: string, lang: string, opts?: {
    maxCallsPerFile?: number;
}): FileRecord;
declare function keptCodeFiles(root: string, opts?: ScanOptions): {
    f: WalkedFile;
    lang: string;
}[];
interface ScanSummary {
    root: string;
    commit?: string;
    fileCount: number;
    languages: Record<string, number>;
    capped: boolean;
    excluded: number;
}
declare function scanSummary(root: string, opts?: ScanOptions): ScanSummary;
declare function scanRepo(root: string, opts?: ScanOptions): RepoScan;

type PathVerdictReason = ScanSkip["reason"] | "outside-repo" | "not-found" | "max-files" | "no-indexed-files" | "not-walked";
interface PathVerdict {
    path: string;
    indexed: boolean;
    reason: PathVerdictReason | null;
    detail: Record<string, unknown>;
}
declare function scanSkips(root: string, opts?: ScanOptions): {
    skips: ScanSkip[];
    files: WalkedFile[];
    capped: boolean;
};
declare function skipHistogram(skips: readonly ScanSkip[]): Record<string, number>;
declare function whyPath(root: string, path: string, opts?: ScanOptions): PathVerdict;

type PersistedCacheEntry = {
    hash: string;
    record: FileRecord;
    size?: number;
    mtimeMs?: number;
};
type PersistedCacheMap = Map<string, PersistedCacheEntry>;
interface ExtractionProfile {
    grammars: string[];
    maxCallsPerFile?: number;
}

interface BuildIndexOptions extends ScanOptions {
    meta?: {
        version?: string;
        schemaVersion?: number;
    };
    previousCommunities?: Record<string, string[]>;
}
interface IndexArtifacts {
    scan: RepoScan;
    graph: Graph;
    symbols: SymbolIndex;
}
declare function buildIndexArtifacts(repo: string, opts?: BuildIndexOptions): IndexArtifacts;
declare function buildArtifactsFromScan(scan: RepoScan, opts?: BuildIndexOptions): IndexArtifacts;

declare const INDEX_DIR = ".codeindex";
interface PersistedMeta {
    engineVersion?: string;
    commit?: string;
    graphSha1?: string;
    symbolsSha1?: string;
    embed?: {
        embedVersion?: number;
        modelId?: string;
        sha1?: string;
    };
    extraction?: ExtractionProfile;
}
declare function toCacheMap(scan: RepoScan): PersistedCacheMap;
type UnusableIndex = "absent" | "unreadable" | "corrupt" | "schema" | "extractor";
declare function readPersistedIndex(repo: string, indexDir?: string): {
    cacheMap: PersistedCacheMap;
    meta: PersistedMeta;
} | undefined;
declare function preloadArtifacts(repo: string, scan: RepoScan, meta: PersistedMeta, indexDir?: string): IndexArtifacts | undefined;
declare function preloadSession(repo: string, opts: Omit<ScanOptions, "cache">, indexDir?: string): {
    scan: RepoScan;
    cacheMap: PersistedCacheMap;
    arts?: IndexArtifacts;
} | undefined;

interface TreeDrift {
    indexed: number;
    unchanged: number;
    touched: number;
    modified: number;
    added: number;
    deleted: number;
    reextract: number;
}

type IndexStaleness = UnusableIndex | "engine-version" | "extraction" | "files" | "graph.json" | "symbols.json";
interface IndexStatus {
    indexDir: string;
    present: boolean;
    usable: boolean;
    reason?: UnusableIndex;
    engineVersion: {
        index: string | null;
        current: string;
    };
    commit: {
        index: string | null;
        head: string | null;
    };
    files: TreeDrift | null;
    artifactsFresh: boolean;
    stale: IndexStaleness[];
}
interface IndexStatusOptions extends Omit<ScanOptions, "cache" | "precomputedWalk" | "extracted"> {
    ast?: boolean;
}
declare function indexStatus(repo: string, opts?: IndexStatusOptions, indexDir?: string): IndexStatus;

interface Job {
    abs: string;
    rel: string;
    ext: string;
    cachedHash?: string;
}
interface WorkerInput {
    jobs: Job[];
    grammarKeys: string[];
    maxCallsPerFile?: number;
}
interface WorkerOutput {
    ready: string[];
    records: {
        rel: string;
        size: number;
        mtimeMs: number;
        hash: string;
        record?: FileRecord;
    }[];
}
declare function workerCount(requested?: number): number;
declare function runExtractWorker(input: WorkerInput, post: (out: WorkerOutput) => void): Promise<void>;
declare function extractInParallel(jobs: Job[], grammarKeys: string[], count: number, opts?: {
    maxCallsPerFile?: number;
}): Promise<Map<string, ExtractedRecord> | undefined>;
declare function scanRepoParallel(root: string, opts?: ScanOptions & {
    workers?: number;
}): Promise<RepoScan>;

declare function compileGlobs(globs: string[] | undefined): ((rel: string) => boolean) | null;

interface IgnoreRule {
    re: RegExp;
    negated: boolean;
    dirOnly: boolean;
    test?: (rel: string, base: string) => boolean;
    source?: string;
    line?: number;
    pattern?: string;
}
declare function parseGitignore(content: string, baseRel: string, source?: string): IgnoreRule[];
declare function isIgnored(rules: readonly IgnoreRule[], rel: string, isDir: boolean): boolean;
declare function decidingRule(rules: readonly IgnoreRule[], rel: string, isDir: boolean): IgnoreRule | undefined;

declare const MARKDOWN_EXT: Set<string>;
declare function isDoc(rel: string, ext: string): boolean;
declare function isCode(ext: string): boolean;
declare function classify(rel: string, ext: string): FileKind;

type FileCategory = "code" | "test" | "config" | "schema" | "i18n" | "doc" | "style" | "asset" | "data" | "other";
declare function categorize(rel: string, ext: string): FileCategory;

declare function extToLang(ext: string): string;

declare function extractSymbols(rel: string, ext: string, content: string): CodeSymbol[];
declare function languageOf(ext: string): string;

type GeneratedKind = NonNullable<FileRecord["generated"]>;

interface CodeInfo {
    symbols: CodeSymbol[];
    summary?: string;
    truncated?: true;
    generated?: GeneratedKind;
    refs: RawRef[];
    pkg?: string;
    idents?: string[];
    calls?: {
        name: string;
        line: number;
        receiver?: string;
    }[];
    importedNames?: string[];
    importAliases?: ImportAlias[];
    terms?: string[];
    literals?: CodeLiteral[];
    relations?: RawRelation[];
}
declare function extractCode(rel: string, ext: string, content: string, opts?: {
    maxCallsPerFile?: number;
}): CodeInfo;

interface MarkdownInfo {
    title?: string;
    summary?: string;
    headings: string[];
    refs: RawRef[];
}
declare function extractMarkdown(content: string): MarkdownInfo;

declare function extractRst(rel: string, content: string): MarkdownInfo;

declare const CORE_GRAMMARS: Set<string>;
declare const EXTENDED_GRAMMARS: Set<string>;
declare const EXT_GRAMMAR: Record<string, string>;
declare function grammarKeyForExt(ext: string): string | undefined;
type GrammarsTierName = "adjacent" | "env" | "cache" | "none";
interface GrammarsTier {
    tier: GrammarsTierName;
    dir?: string;
    cacheDir: string;
    dirs: string[];
}
declare function sharedGrammarsCacheDir(): string;
declare function resolveGrammarsTier(opts?: {
    moduleDir?: string;
}): GrammarsTier;
declare function resolveGrammarsDir(opts?: {
    moduleDir?: string;
}): string | undefined;
declare function ensureGrammars(keys: Iterable<string>): Promise<void>;
declare function allGrammarKeys(): string[];
declare function grammarKeysForExts(exts: Iterable<string>): string[];
declare function grammarReady(key: string): boolean;

interface AstResult {
    symbols: CodeSymbol[];
    refs: RawRef[];
    pkg?: string;
    idents: string[];
    calls: {
        name: string;
        line: number;
        receiver?: string;
    }[];
    importedNames: string[];
    importAliases: ImportAlias[];
    relations: RawRelation[];
    terms: string[];
    literals: CodeLiteral[];
    truncated?: true;
}
declare function extractAst(rel: string, ext: string, content: string, opts?: {
    maxCalls?: number;
    imports?: boolean;
    maxSymbols?: number;
}): AstResult | undefined;

/** One definition a tags query captured. */
interface TagDefinition {
    /** The `@definition.<kind>` suffix — function, class, method, module, … */
    kind: string;
    name: string;
    line: number;
}
/** Whether a vendored query exists for a grammar, and whether it compiled. */
interface TagsQueryStatus {
    /** A `<key>.tags.scm` was found next to the grammar. */
    present: boolean;
    /** It compiled against the loaded grammar. False means the two are out of step. */
    compiled: boolean;
}
/**
 * Report a grammar's query status. `extractTags` degrades to `[]` for a query
 * that does not compile, which is right at runtime but makes a broken query
 * indistinguishable from one that simply matched nothing — so the audit and its
 * tests can check the difference here instead of guessing from an empty result.
 */
declare function tagsQueryStatus(key: string): TagsQueryStatus;
/**
 * Definitions the grammar's own `tags.scm` finds in this source, deduped and
 * sorted. Empty when the grammar publishes no query, when it fails to compile,
 * or when no grammar is loaded for the extension.
 */
declare function extractTags(ext: string, content: string): TagDefinition[];

declare const DEFAULT_GRAMMARS_URL = "https://github.com/maxgfr/codeindex/releases/download/v2.31.2/grammars-2.31.2.tar.gz";
interface GrammarsPullTarget {
    url: string;
    sha256Url?: string;
}
declare function resolveGrammarsPullTarget(): GrammarsPullTarget;
declare function fetchGrammarsTarball(url: string, expectedSha256?: string): Promise<Uint8Array>;
declare function fetchExpectedSha256(url: string): Promise<string>;
declare function extractTarInto(rawTar: Uint8Array, destDir: string): string[];
declare function extractGrammarsTarball(bytes: Uint8Array, destDir: string): string[];
interface GrammarsPullResult {
    ok: boolean;
    status: "up-to-date" | "pulled" | "failed";
    cacheDir: string;
    /** One human-readable line; the CLI writes it to stderr, a library caller may log or drop it. */
    message: string;
}
declare function pullGrammars(cacheDir: string, opts?: {
    onNote?: (msg: string) => void;
}): Promise<GrammarsPullResult>;

interface WarmGrammarsResult {
    /** Tier AFTER the warm-up (a successful pull moves "none" → "cache"). */
    tier: GrammarsTierName;
    /** True when at least one requested grammar is loaded ⇒ the AST tier is live. */
    ready: boolean;
    /** True when this call populated the shared cache over the network. */
    pulled: boolean;
    /** Everything written to `onNote`, in order — so a caller can persist the trail in its run artifacts. */
    notes: string[];
}
interface WarmGrammarsOptions {
    /** Grammars to load. Default: every shipped grammar. Narrow it with `grammarKeysForExts` when the repo's languages are known. */
    keys?: Iterable<string>;
    /** Fetch the wasms into the shared cache when nothing is resolvable. Default true; `CODEINDEX_NO_GRAMMARS_PULL=1` forces false. */
    pull?: boolean;
    /** Prefix for the diagnostics ("ultrasec: …"). Default "codeindex". */
    label?: string;
    /** Where diagnostics go. Default: process.stderr. Pass a sink to keep stdout/stderr clean. */
    onNote?: (msg: string) => void;
}
declare function warmGrammars(opts?: WarmGrammarsOptions): Promise<WarmGrammarsResult>;

type Resolution = {
    kind: "resolved";
    target: string;
} | {
    kind: "external";
} | {
    kind: "dangling";
    reason: string;
};
interface TsPath {
    prefix: string;
    star: boolean;
    targets: string[];
}
interface TsConfigScope {
    dir: string;
    baseUrl: string;
    baseUrlSet: boolean;
    paths: TsPath[];
}
interface ExportEntry {
    key: string;
    star: boolean;
    targets: string[];
}
interface WorkspacePackage$1 {
    name: string;
    dir: string;
    exportEntries: ExportEntry[];
    mainCandidates: string[];
    tsconfig?: string;
}
interface PackageScope {
    dir: string;
    importEntries: ExportEntry[];
}
interface GoModule {
    module: string;
    dir: string;
    replaces: {
        from: string;
        toDir: string;
    }[];
}
interface RustCrate {
    name: string;
    dir: string;
    srcDir: string;
    rootFile?: string;
    renames?: Map<string, string>;
    edition2015?: boolean;
}
interface JvmIndex {
    types: Map<string, string>;
    packages: Map<string, string>;
    scalaPkg: Map<string, string>;
}
interface ResolveContext {
    fileSet: Set<string>;
    dirSet: Set<string>;
    filesByDir: Map<string, string[]>;
    tsConfigs: TsConfigScope[];
    goModules: GoModule[];
    rustCrates: RustCrate[];
    javaRoots: string[];
    pyRoots: string[];
    workspacePackages: WorkspacePackage$1[];
    packageScopes: PackageScope[];
    cIncludeRoots: string[];
    rubyLibRoots: string[];
    phpPsr4: {
        prefix: string;
        dir: string;
    }[];
    csharpNamespaces: Map<string, string[]>;
    jvm?: JvmIndex;
    csharpPrefix?: Map<string, string>;
    dartPackages?: Map<string, string>;
    luaRoots?: string[];
    elixirModules?: Map<string, string>;
    warnings: string[];
    jsMemo?: Map<string, Resolution>;
    pyMemo?: Map<string, Resolution>;
    dirFilesMemo?: Map<string, string[]>;
}
declare function buildResolveContext(scan: RepoScan): ResolveContext;
declare function resolveDocLink(fromRel: string, spec: string, ctx: ResolveContext): Resolution;
declare function resolveImport(fromRel: string, ext: string, spec: string, ctx: ResolveContext): Resolution;

interface ModuleInfo {
    slug: string;
    path: string;
    title: string;
    tier: Tier;
    members: string[];
    summary: string;
}
declare function isTestFile(rel: string): boolean;
declare function tierForPath(path: string): Tier | null;
declare function buildModules(scan: RepoScan): {
    modules: ModuleInfo[];
    moduleOf: Map<string, string>;
};

declare function uniqueSymbolDefs(scan: RepoScan): Map<string, string>;
declare function buildGraph(scan: RepoScan, ctx: ResolveContext, modules: ModuleInfo[], moduleOf: Map<string, string>, meta?: {
    version?: string;
    schemaVersion?: number;
}): Graph;

declare function resolveCallEdges(scan: RepoScan, importPairs: Set<string>, ctx?: ResolveContext): Edge[];

/** One inheritance link with both ends bound to a declaration site. */
interface ResolvedRelation {
    kind: "extends" | "implements";
    from: string;
    fromFile: string;
    fromLine: number;
    to: string;
    toFile: string;
    toKind: string;
}
/**
 * Every inheritance relation in the repo whose target resolves to a declaration
 * here. Targets that do not (a framework base class, `std::exception`) are
 * omitted — they are reported per-type as `unresolved` by the hierarchy below,
 * so the information is available without inventing an edge to nothing.
 *
 * Deterministic: sorted, and never dependent on Map iteration order.
 */
declare function resolveRelations(scan: RepoScan, importPairs: Set<string>, ctx?: ResolveContext): ResolvedRelation[];
/**
 * File-level `extends`/`implements` edges, aggregated per (from, to, kind) pair.
 * Self-edges are dropped: a type extending another in the same file is a real
 * relation (the hierarchy reports it) but not a dependency between files.
 */
declare function resolveRelationEdges(scan: RepoScan, importPairs: Set<string>, ctx?: ResolveContext): Edge[];
/** One end of a relation, as reported by the hierarchy. */
interface HierarchyRef {
    name: string;
    file: string;
    line: number;
    kind: string;
    /** A Go type whose method set covers the interface's, with no assertion saying so. */
    structural?: true;
}
interface TypeHierarchyEntry {
    name: string;
    file: string;
    line: number;
    kind: string;
    /** Base classes/supertraits this type declares, resolved. */
    extends: HierarchyRef[];
    /** Interfaces/traits/mixins this type provides, resolved. */
    implements: HierarchyRef[];
    /** Types that extend THIS one. */
    extendedBy: HierarchyRef[];
    /** Types that implement THIS one — the "who implements this interface" answer. */
    implementedBy: HierarchyRef[];
    /** Declared supertypes with no definition in this repo (a framework base class). */
    unresolved: {
        kind: "extends" | "implements";
        to: string;
    }[];
}
/**
 * The full type hierarchy, keyed by `name` (and by `name@file` for a homonym
 * declared in more than one file, mirroring how the caller index disambiguates).
 * Insertion order is sorted, so serializing the map is deterministic.
 */
declare function buildTypeHierarchy(scan: RepoScan, importPairs: Set<string>): Map<string, TypeHierarchyEntry>;
/**
 * Everything that implements or extends `name`, TRANSITIVELY — the practical
 * form of "who implements this interface": a class implementing a sub-interface
 * of the one asked about is an implementation too, and a caller should not have
 * to walk the chain itself. Breadth-first, cycle-safe, deterministic.
 */
declare function implementationsOf(hierarchy: Map<string, TypeHierarchyEntry>, name: string, declarations?: readonly {
    name: string;
    file: string;
}[]): HierarchyRef[];
/**
 * The type a symbol ref names — `Name`, `Name@file`, `file#Name` (see
 * src/symref.ts). A bare name answers with the key the hierarchy stores it
 * under (the first homonym); the qualified forms reach every homonym.
 *
 * Entries do not record where a type is nested, so a ref constraining the
 * PARENT (`Outer/Inner`, `file#Outer/Inner`) is settled by `declarations`:
 * what the ref resolved to against the scan (query.ts resolveSymbolRef).
 */
declare function typeEntry(hierarchy: Map<string, TypeHierarchyEntry>, name: string, declarations?: readonly {
    name: string;
    file: string;
}[]): TypeHierarchyEntry | undefined;

type SymbolEdgeKind = "calls" | "extends" | "implements" | "overrides";
interface SymbolNode {
    /** Stable id: `file#Parent/name` for a member, `file#name` otherwise. */
    id: string;
    name: string;
    kind: string;
    file: string;
    line: number;
    endLine?: number;
    exported: boolean;
    doc?: string;
    signature?: string;
}
interface SymbolEdge {
    from: string;
    to: string;
    kind: SymbolEdgeKind;
    /** How many distinct call sites back a `calls` edge. Always 1 for inheritance and overrides. */
    weight: number;
}
interface SymbolGraph {
    nodes: Map<string, SymbolNode>;
    edges: SymbolEdge[];
    /** id → outgoing edges, and id → incoming; both sorted. */
    out: Map<string, SymbolEdge[]>;
    in: Map<string, SymbolEdge[]>;
    /** name → every node id declaring it, for looking a symbol up by bare name. */
    byName: Map<string, string[]>;
}
declare function symbolId(s: Pick<CodeSymbol, "file" | "name" | "parent">): string;
/**
 * Build the symbol graph. `importPairs` is the resolved-import pair set the call
 * binder uses for corroboration — pass the memoised one (derived.ts) so this
 * shares work with the rest of a session.
 *
 * Deterministic: edges are aggregated into a Map keyed by (from, to, kind) and
 * sorted before return, so two builds of one scan agree exactly.
 */
declare function buildSymbolGraph(scan: RepoScan, importPairs: Set<string>): SymbolGraph;
type Direction = "out" | "in" | "both";
interface Neighborhood {
    /** Every declaration matching the requested name — the walk starts from all of them. */
    root: SymbolNode[];
    /** Reached nodes with the hop count at which each was first seen (root = 0). */
    nodes: (SymbolNode & {
        depth: number;
    })[];
    edges: SymbolEdge[];
    /** True when the node cap stopped the walk short. */
    truncated?: true;
    /** The hop limit actually walked, present when a deeper walk was asked for. */
    depthClamped?: number;
}
/**
 * The bounded neighborhood of a symbol. Breadth-first, so `depth` is the true
 * hop distance; cycle-safe; capped at MAX_NODES with `truncated` set rather than
 * quietly returning a partial answer.
 */
declare function neighborhood(graph: SymbolGraph, name: string, opts?: {
    depth?: number;
    direction?: Direction;
}): Neighborhood;

interface CallerSite {
    file: string;
    line: number;
    confidence?: "corroborated" | "unique-name";
    caller?: string;
}
interface CallerIndexOptions {
    recall?: boolean;
}
interface CallerEntry {
    def: CodeSymbol;
    callers: CallerSite[];
}
type CallerIndex = Map<string, CallerEntry>;
declare function computeImportPairs(scan: RepoScan): Set<string>;
declare function buildCallerIndex(scan: RepoScan, importPairs?: Set<string>, opts?: CallerIndexOptions): CallerIndex;
declare function enclosingSymbol(scan: RepoScan, file: string, line: number): CodeSymbol | undefined;
interface RawCallerSite {
    file: string;
    line: number;
    receiver?: string;
    enclosingSymbol?: CodeSymbol;
}
type RawCallerIndex = Map<string, RawCallerSite[]>;
declare function buildRawCallerIndex(scan: RepoScan): RawCallerIndex;

declare function symbolsOverview(scan: RepoScan, rel: string): CodeSymbol[];
interface SymbolMatch extends CodeSymbol {
    body?: string;
}
interface FindSymbolOptions {
    substring?: boolean;
    includeBody?: boolean;
    maxResults?: number;
    /**
     * Return only what LOCATES a declaration — name, kind, file, line — dropping
     * the signature, line span, visibility and language.
     *
     * The default answer carries the complete signature because "what shape is
     * it" is the question that follows "where is it" almost every time, and one
     * round trip beats two. But it is not free: measured on `Route` in
     * create-t3-turbo, the full answer is 1,561 bytes against 640 for a
     * locate-only one — and when the caller genuinely only wants a path, the
     * signature is context spent on a question nobody asked.
     *
     * So it is the CALLER's choice rather than ours, and the default does not
     * move: an agent that knows it is only resolving a path can say so.
     */
    concise?: boolean;
}
declare function findSymbol(scan: RepoScan, namePath: string, opts?: FindSymbolOptions): SymbolMatch[];
interface SymbolReferences {
    defs: CodeSymbol[];
    callSites: (CallerSite & {
        def?: string;
    })[];
    referencingFiles: string[];
}
declare function findReferences(scan: RepoScan, ref: string): SymbolReferences;

interface EditResult {
    file: string;
    startLine: number;
    endLine: number;
    lines: number;
    warnings?: string[];
}
interface EditOptions {
    line?: number;
    strict?: boolean;
}
declare function resolveUniqueSymbol(scan: RepoScan, namePath: string, file?: string, line?: number): CodeSymbol;
declare function replaceSymbolBody(scan: RepoScan, namePath: string, body: string, file?: string, opts?: EditOptions): EditResult;
declare function insertAfterSymbol(scan: RepoScan, namePath: string, body: string, file?: string, opts?: EditOptions): EditResult;
declare function insertBeforeSymbol(scan: RepoScan, namePath: string, body: string, file?: string, opts?: EditOptions): EditResult;

declare function writeMemory(repo: string, name: string, content: string): string;
declare function readMemory(repo: string, name: string): string | undefined;
declare function deleteMemory(repo: string, name: string): boolean;
declare function listMemories(repo: string): string[];

type WorkspaceKind = "npm" | "pnpm" | "lerna" | "nx" | "cargo" | "go" | "maven" | "uv" | "composer" | "gradle";
interface WorkspacePackage {
    name: string;
    dir: string;
    kind: WorkspaceKind;
    manifest: string;
    description?: string;
    dependsOn?: string[];
}
interface WorkspaceInfo {
    packages: WorkspacePackage[];
    cycle?: string[];
    topoOrder: string[];
    warnings: string[];
    packageOf(rel: string): WorkspacePackage | undefined;
}
declare function detectWorkspaces(root: string): WorkspaceInfo;

declare function pagerankOf(ids: string[], edges: Edge[], damping?: number): Map<string, number>;
declare function betweennessOf(ids: string[], edges: Edge[]): Map<string, number>;
declare function applyCentrality(graph: Graph): string[];

declare function communityOf(graph: Graph, slug: string): number | undefined;
declare function detectCommunities(modules: ModuleNode[], edges: Edge[], previous?: Record<string, string[]>): Map<string, number>;

declare function isTestPath(rel: string): boolean;
interface TestMap {
    testFiles: Set<string>;
    testedByFile: Map<string, string[]>;
    testedByModule: Map<string, string[]>;
}
declare function computeTestMap(graph: Graph): TestMap;
declare function testsForModule(graph: Graph, slug: string): string[];
declare function untestedModules(graph: Graph): ModuleNode[];

declare function computeSurprises(graph: Graph): SurpriseEdge[];
declare function isSurprising(graph: Graph, from: string, to: string): boolean;

declare function computeSymbolRefs(scan: RepoScan): Map<string, Set<string>>;
declare function buildSymbolIndex(scan: RepoScan, refs?: Map<string, Set<string>>, schemaVersion?: number): SymbolIndex;
declare function renderSymbolsJson(index: SymbolIndex): string;

declare function renderGraphJson(graph: Graph): string;

interface RenderScipOptions {
    projectRoot?: string;
    toolVersion?: string;
}
declare function renderScip(scan: RepoScan, opts?: RenderScipOptions): Uint8Array;

declare function headCommit(dir: string): string | undefined;
interface DiffFile {
    path: string;
    status: "added" | "modified" | "deleted" | "renamed";
    oldPath?: string;
    binary?: boolean;
    linesAdded?: number;
    linesDeleted?: number;
}
interface Hunk {
    start: number;
    end: number;
    approx?: boolean;
}
interface DiffSpec {
    mergeBase?: string;
    staged?: boolean;
}
declare function isGitWorktree(dir: string): boolean;
declare function resolveBaseRef(dir: string, base?: string): {
    ref: string;
    mergeBase: string;
    note?: string;
} | {
    error: string;
};
declare function diffFiles(dir: string, spec: DiffSpec): DiffFile[];
declare function diffHunks(dir: string, spec: DiffSpec): Map<string, Hunk[]>;
declare function untrackedFiles(dir: string): string[];
interface ChurnResult {
    churn: Map<string, number>;
    ok: boolean;
    error?: string;
    shallow?: boolean;
    commits: number;
}
declare function gitChurn(dir: string, opts?: {
    since?: string;
}): ChurnResult;
declare function changedSince(dir: string, ref: string): Set<string>;

interface SearchHit {
    file: string;
    line: number;
    col: number;
    text: string;
}
interface GrepOptions {
    globs?: string[];
    scope?: string;
    maxHits?: number;
    ignoreCase?: boolean;
    filesWithMatches?: boolean;
    gitignore?: boolean;
    ignoreDirs?: string[];
    maxFileBytes?: number;
    timeoutMs?: number;
    noRipgrep?: boolean;
}
interface GrepResult {
    hits: SearchHit[];
    truncated: boolean;
    filesMatched: number;
    timedOut: boolean;
    notes: string[];
}
declare function grepRepoEx(root: string, pattern: string, opts?: GrepOptions): GrepResult;
declare function grepRepo(root: string, pattern: string, opts?: GrepOptions): SearchHit[];

interface ShResult {
    ok: boolean;
    status: number | null;
    stdout: string;
    stderr: string;
    missing: boolean;
    errorCode?: string;
}
declare function sh(cmd: string, args: string[], opts?: {
    cwd?: string;
    input?: string;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
    maxBufferBytes?: number;
}): ShResult;
declare function have(cmd: string): boolean;
declare function slugify(input: string): string;
declare function clip(s: string, max: number): string;
declare function clipInline(s: string, max: number): string;
declare function escapeRegExp(s: string): string;
declare function foldText(s: string): string;
declare function keywords(question: string, keep?: (raw: string) => boolean): string[];
declare function rankedKeywords(question: string): string[];
declare function rrf<T>(lists: T[][], keyOf: (item: T) => string, k?: number): Map<string, number>;
declare function subtokens(raw: string): string[];

declare const FIELDS: readonly ["name", "path", "heading", "summary", "doc", "body"];
type Field = (typeof FIELDS)[number];
type RankMode = "graph" | "lexical";
interface SearchOptions {
    limit?: number;
    fuzzy?: boolean;
    exact?: boolean;
    rank?: RankMode;
}
/** A specific declaration a result matched, so a caller can jump straight to it. */
interface SymbolHit {
    name: string;
    kind: string;
    line: number;
}
interface SearchResult {
    file: string;
    score: number;
    matchedTerms: string[];
    topSymbols: string[];
    matchedFields?: Field[];
    line?: number;
    symbolHits?: SymbolHit[];
    fuzzyTerms?: string[];
    bridgedOnly?: true;
}
/**
 * Whether the query really found anything, as one word.
 *
 * `weak` is the case this whole diagnostic exists for. Searching `nullGipStep7`
 * against a repo that has `nullGipStep2` returns twenty results at scores no
 * different from a real hit, because `subtokens` splits the identifier into
 * ["nullgipstep7", "null", "gip", "step7"] and the subtokens match plenty of
 * files on their own. The one token that mattered — the whole identifier — has
 * df 0, no bridge, and appeared in NO output field at all. A caller could not
 * tell "found it" from "found nothing and improvised".
 */
type QueryVerdict = "match" | "weak" | "none";
interface TermDiagnostic {
    term: string;
    df: number;
    /** How a df==0 term still earned score, when it did. Absent when df > 0. */
    bridge?: {
        via: "stem" | "trigram";
        to: string[];
        dice: number;
    };
}
interface QueryExplanation {
    query: string;
    /** Post keywords() + subtokens(), in query order. */
    terms: TermDiagnostic[];
    /**
     * Raw tokens keywords() discarded as stopwords or 1-char noise, in order. A
     * stopword the query searched for after all — the query's only word, or a
     * capitalised name the corpus declares — is not listed.
     */
    droppedStopwords: string[];
    /** df==0 AND no stem/trigram bridge — present in the repo nowhere, sorted. */
    unresolvedTerms: string[];
    /**
     * For a single-token query, the whole lowercased identifier with its df.
     * df 0 here means the thing asked for is not in this tree, whatever the
     * rows below say.
     */
    wholeIdentifier?: {
        term: string;
        df: number;
    };
    verdict: QueryVerdict;
    /** A sentence a human or an agent can act on. Absent when verdict is "match". */
    note?: string;
    bridgedOnlyResults: number;
    resultCount: number;
}
interface ExplainedSearch {
    results: SearchResult[];
    explain: QueryExplanation;
}
/**
 * Rank the scanned files against a natural-language (or identifier) query.
 * Pure and deterministic: same scan + query + options → the same results,
 * byte-for-byte.
 */
declare function searchIndex(scan: RepoScan, query: string, opts?: SearchOptions): SearchResult[];
/**
 * `searchIndex` plus the diagnostics it throws away, in ONE pass.
 *
 * `explainQuery(scan, q, o).results` is `searchIndex(scan, q, o)`, asserted by
 * a test rather than promised by a comment — they are literally the same code
 * path, which is why the ranking cannot drift between them.
 */
declare function explainQuery(scan: RepoScan, query: string, opts?: SearchOptions): ExplainedSearch;

declare const EMBED_VERSION = 2;
interface StaticEmbedModel {
    modelId: string;
    dim: number;
    unk: string;
    unkId: number;
    vocabSize: number;
    vocab: Map<string, number>;
    weights: Float64Array;
}
declare function resolveEmbedModelDir(repo?: string): string | undefined;
declare function hasEmbedModel(repo?: string): boolean;
declare function loadEmbedModel(dir?: string): StaticEmbedModel | undefined;
interface EmbedPullTarget {
    url: string;
    sha256?: string;
}
declare function resolveEmbedPullUrl(): EmbedPullTarget;

declare function basicTokenize(text: string): string[];
declare function wordpiece(word: string, model: StaticEmbedModel): number[];
declare function tokenize(text: string, model: StaticEmbedModel): number[];
declare function roundHalfToEven(x: number): number;
declare function quantize(vec: ArrayLike<number>): Int8Array;
declare function encode(model: StaticEmbedModel, text: string): Int8Array;
declare function intDot(a: Int8Array, b: Int8Array): number;

interface EmbeddingRecord {
    file: string;
    symbol?: string;
    line?: number;
    textHash?: string;
    vec: Int8Array;
}
interface EmbeddingIndex {
    embedVersion: number;
    modelId: string;
    dim: number;
    records: EmbeddingRecord[];
}
interface EmbeddingUnit {
    file: string;
    symbol?: string;
    line?: number;
    text: string;
}
declare function unitHash(text: string): string;
declare function embeddingUnits(scan: RepoScan): EmbeddingUnit[];
declare function buildEmbeddingIndex(scan: RepoScan, model: StaticEmbedModel, opts?: {
    previous?: EmbeddingIndex;
}): EmbeddingIndex;
declare function serializeEmbeddings(index: EmbeddingIndex): Uint8Array;
declare function deserializeEmbeddings(bytes: Uint8Array): EmbeddingIndex;

interface SemanticSearchOptions extends SearchOptions {
    model?: StaticEmbedModel;
    queryVec?: Int8Array;
    rrfK?: number;
}
interface SemanticSearchResult extends SearchResult {
    semanticSymbol?: string;
}
interface SemanticQueryExplanation extends QueryExplanation {
    /** Rows only the embedding side found — no lexical match at all. */
    semanticOnlyResults: number;
}
interface ExplainedSemanticSearch {
    results: SemanticSearchResult[];
    explain: QueryExplanation | SemanticQueryExplanation;
}
declare function explainSemantic(scan: RepoScan, query: string, index: EmbeddingIndex | undefined, opts?: SemanticSearchOptions): ExplainedSemanticSearch;
declare function searchSemantic(scan: RepoScan, query: string, index: EmbeddingIndex | undefined, opts?: SemanticSearchOptions): SemanticSearchResult[];

interface EmbedEndpointOptions {
    url?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
    batchSize?: number;
    concurrency?: number;
}
declare function resolveEmbedEndpoint(opts?: EmbedEndpointOptions): string | undefined;
declare function embedEndpointUrl(base: string): string;
declare function healthzUrl(base: string): string;
declare function embedViaEndpoint(texts: string[], opts?: EmbedEndpointOptions): Promise<number[][]>;
declare function probeEndpoint(base: string, opts?: EmbedEndpointOptions): Promise<boolean>;
declare function encodeQueryViaEndpoint(query: string, opts?: EmbedEndpointOptions): Promise<Int8Array>;
declare function endpointModelId(opts?: EmbedEndpointOptions): Promise<string>;
declare function buildEndpointIndex(scan: RepoScan, opts?: EmbedEndpointOptions & {
    previous?: EmbeddingIndex;
    modelId?: string;
}): Promise<EmbeddingIndex>;

interface OnboardOptions {
    /** Token budget for the repo-map section (default 900). */
    budgetTokens?: number;
    /** Persist the brief as a memory (default true). */
    remember?: boolean;
    /** Memory name (default "onboarding"). */
    memoryName?: string;
}
interface OnboardBrief {
    /** The rendered brief, markdown. */
    brief: string;
    /** Where it was persisted, when it was. */
    memory?: string;
}
/**
 * Compose a project brief from the analyses this engine already computes.
 *
 * Deterministic apart from the git section, which is skipped wholesale when
 * this is not a git checkout rather than emitted empty — a heading with nothing
 * under it reads as "no churn", which is a different claim from "not measured".
 */
declare function onboardBrief(scan: RepoScan, graph: Graph, opts?: OnboardOptions): OnboardBrief;

interface LspMessage {
    jsonrpc: "2.0";
    id?: number | string;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
/** A reference the LSP reported, normalised to the engine's 1-based lines. */
interface LspRef {
    /** Repo-relative, posix separators — the same key every other artifact uses. */
    file: string;
    line: number;
    character?: number;
}
/** A call site, distinct from the declaration of the function making it. */
interface LspIncomingCall extends LspRef {
    caller: LspRef & {
        name: string;
        kind: number;
    };
}
/**
 * The largest frame this client will assemble, in bytes.
 *
 * Not a performance knob: a malformed or hostile `Content-Length` is otherwise
 * an unbounded allocation driven by a process the user configured but did not
 * write. 32 MiB is far above any real `textDocument/references` response.
 */
declare const MAX_FRAME_BYTES: number;
declare function encodeMessage(msg: LspMessage): string;
/**
 * An incremental frame reader.
 *
 * Feed it whatever arrives; it returns the messages that are complete. Buffers
 * BYTES rather than a string, because decoding each chunk on arrival is what
 * corrupts a multi-byte character split across two chunks.
 */
declare function createFramer(): {
    push(chunk: Uint8Array | string): LspMessage[];
};
/** `file:///abs/path` for a repo-relative path, percent-encoding each segment. */
declare function fileUri(root: string, rel: string): string;
/** The inverse, or undefined when the URI points outside the repository. */
declare function relFromUri(root: string, uri: string): string | undefined;
/**
 * Normalise whatever `textDocument/references` or `textDocument/definition`
 * returned into engine coordinates.
 *
 * Handles all three shapes the spec permits — a single Location, an array of
 * Locations, and an array of LocationLinks — because which one you get is a
 * per-server, per-request choice, and a client that assumes one silently
 * returns nothing against the others.
 *
 * LSP lines are 0-based; every line number in this engine is 1-based. Output is
 * deduped and sorted so an LSP answer is as deterministic as a static one, even
 * though the server's ordering is not guaranteed.
 */
declare function locationsToRefs(root: string, raw: unknown): LspRef[];

interface LspTransport {
    write(chunk: string): void;
    onData(cb: (chunk: Uint8Array | string) => void): void;
    /** Fired when the far side goes away, however it went away. */
    onExit(cb: (code: number | null) => void): void;
    close(): void;
    /** The last non-empty line the far side wrote to stderr, when there is one. */
    lastError?(): string | undefined;
    /** Kill the far side NOW, synchronously — for a host that is exiting. */
    kill?(): void;
}
interface LspSessionOptions {
    /** Absolute repository root; every URI is built against it. */
    root: string;
    timeoutMs?: number;
    startupTimeoutMs?: number;
    initializationOptions?: unknown;
}
interface LspCapabilities {
    references: boolean;
    definition: boolean;
    implementation: boolean;
    typeHierarchy: boolean;
    callHierarchy: boolean;
}
interface LspSession {
    readonly capabilities: LspCapabilities;
    didOpen(rel: string, text: string, languageId: string): void;
    references(rel: string, line: number, character: number): Promise<LspRef[]>;
    definition(rel: string, line: number, character: number): Promise<LspRef[]>;
    incomingCalls(rel: string, line: number, character: number): Promise<LspIncomingCall[]>;
    shutdown(): Promise<void>;
    /** False once the server died or the session was shut down. */
    alive(): boolean;
}
/** Thrown when a request outlives its budget. Named so callers can tell it apart. */
declare class LspTimeout extends Error {
    constructor(method: string, ms: number);
}
declare function openLspSession(transport: LspTransport, options: LspSessionOptions): Promise<LspSession>;

interface LspServerConfig {
    /** Stable id, used in `source` labels and in `lsp status`. */
    id: string;
    /** Engine `lang` strings (see src/lang/registry.ts), not LSP language ids. */
    languages: string[];
    /** What `didOpen` announces. Defaults to each declaration's language. */
    languageId?: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    initializationOptions?: unknown;
    /** Per-request budget, ms (default 5000). */
    timeoutMs?: number;
    /** How long `initialize` may take, ms (default 15000). */
    startupTimeoutMs?: number;
}
interface LspConfig {
    version: 1;
    servers: LspServerConfig[];
}
type LspConfigSource = "env" | "repo" | "cwd" | "none";
interface ResolvedLspConfigPath {
    path: string | undefined;
    source: LspConfigSource;
}
/**
 * Resolution ladder, mirroring resolveEmbedModelDir: an explicit env var wins
 * outright, then the repo, then the working directory.
 *
 * `CODEINDEX_LSP_CONFIG` set to an empty string, `0` or `off` DISABLES the tier
 * even when a repo config exists — the escape hatch for a CI job that must not
 * spawn anything, without deleting a file the rest of the team relies on.
 */
declare function resolveLspConfigPath(repo: string): ResolvedLspConfigPath;
/** Validate a parsed payload, throwing with the field that is wrong. */
declare function parseLspConfig(payload: unknown): LspConfig;
/**
 * The config for a repository, or undefined when the tier was not asked for.
 *
 * NEVER THROWS on an absent file — absent is the normal case and must cost
 * nothing. A file that exists but is malformed DOES throw, because at that
 * point someone asked for the tier and silently ignoring their config is worse
 * than failing: they would spend the afternoon wondering why nothing improved.
 */
declare function loadLspConfig(repo: string): LspConfig | undefined;
/** The server that claims a language, or undefined. First match wins. */
declare function serverForLang(config: LspConfig, lang: string): LspServerConfig | undefined;

interface LspAgreement {
    /** Files both tiers report — corroborated by two independent methods. */
    both: string[];
    /** Files only the language server found — the static tier under-recalled. */
    lspOnly: string[];
    /** Files only the static tier found — where the homonyms are. */
    staticOnly: string[];
}
interface LspBlock {
    server: string;
    ok: boolean;
    /**
     * The server kept answering with declarations only although the static tier
     * found call sites: it may still be indexing, or those sites are homonyms.
     */
    partial?: true;
    /** Why it could not answer (`ok` false), or why the answer looks partial. */
    reason?: string;
    refs: LspRef[];
    agreement: LspAgreement;
}
interface LspReferences extends SymbolReferences {
    lsp?: LspBlock;
}
/** An `lsp` block for a tier that could not run, with the reason named. */
declare function lspUnavailable(server: string, reason: string): LspBlock;
/**
 * A symbol's column on its declaration line.
 *
 * CodeSymbol carries `line`/`endLine` and no column (src/types.ts), because a
 * column is worth nothing to any other consumer and persisting one would widen
 * every artifact. LSP needs `{line, character}`, so it is derived HERE, from
 * the source, and never stored.
 *
 * Returns 0 when the name is not on that line — a position a server will simply
 * find no references for, which is the right failure: an empty LSP answer that
 * leaves the static tiers untouched.
 */
declare function columnOfSymbol(root: string, rel: string, line: number, name: string): number;
/** Cross the two answers into the agreement matrix, deterministically. */
declare function agreementOf(refs: LspRef[], statik: SymbolReferences): LspAgreement;

interface LspCallersBlock {
    server: string;
    ok: boolean;
    /** No incoming calls although the static tier found callers (see LspBlock). */
    partial?: true;
    reason?: string;
    calls: LspIncomingCall[];
    agreement: LspAgreement;
}
type LspCallers<T extends object> = T & {
    lsp?: LspCallersBlock;
};

type OpenResult = {
    ok: true;
    session: LspSession;
    transport: LspTransport;
} | {
    ok: false;
    reason: string;
};
/** What a query gets to work with, pooled or not. */
interface LspLease {
    session: LspSession;
    /**
     * The session has already given an answer beyond bare declarations, so its
     * index is built: a declaration-only answer from it is believed rather than
     * retried as a server that is still warming up.
     */
    readonly warm: boolean;
    markWarm(): void;
}
type LeaseResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    reason: string;
};
interface LspPoolOptions {
    /** Close a session after this long without a query, ms (default 5 min). */
    idleMs?: number;
    /** How a session is opened; tests inject one. */
    open?: (server: LspServerConfig, root: string) => Promise<OpenResult>;
}
declare class LspSessionPool {
    private readonly entries;
    private readonly idleMs;
    private readonly open;
    private readonly live;
    private readonly killAll;
    private hooked;
    private closed;
    constructor(options?: LspPoolOptions);
    /** Live sessions, for tests and status. */
    get size(): number;
    use<T>(server: LspServerConfig, root: string, stamp: string, fn: (lease: LspLease) => Promise<T>, retried?: boolean): Promise<LeaseResult<T>>;
    /** Shut every session down. The host calls this when it stops. */
    close(): Promise<void>;
    private retire;
    private shutdown;
    private readonly onSignal;
    private hook;
    /** Drop the hooks once nothing they could kill is left. */
    private unhook;
}

/** How a query reaches its servers. */
interface LspQueryOptions {
    /**
     * Reuse sessions across queries (the MCP server passes its own). Without
     * one, each query opens a fresh session and shuts it down before returning.
     */
    pool?: LspSessionPool;
}
interface LspServerStatus {
    id: string;
    languages: string[];
    command: string;
    /** `have(command)` — resolvable on PATH. No spawn. */
    onPath: boolean;
    /** Files in this scan whose language this server claims. */
    filesInRepo: number;
    /** --probe only: did `initialize` succeed, and what did it advertise. */
    reachable?: boolean;
    capabilities?: LspCapabilities;
    error?: string;
}
interface LspStatus {
    lspVersion: 1;
    mode: "none" | "configured";
    configPath: string | null;
    source: LspConfigSource;
    servers: LspServerStatus[];
    /** Languages present in the repo that no configured server claims. */
    unmappedLanguages: string[];
}
/**
 * What the tier would do, without doing it.
 *
 * The default answer is cheap and spawns NOTHING: config, `have()`, and file
 * counts. `probe` is the part that starts each server to read its real
 * capabilities — the analogue of `probeEndpoint` in `embed status`, and like it,
 * the only part that touches the outside world.
 */
declare function lspStatus(scan: RepoScan, repo: string, probe?: boolean): Promise<LspStatus>;
/**
 * `findReferences`, annotated by a language server when one can answer.
 *
 * The caller passes the static answer in, so this function CANNOT change it —
 * a structural guarantee rather than a promise. The server is chosen by the
 * language of the declarations that were found, which is why a repo with a
 * TypeScript server configured still gets its Go references answered
 * statically, silently and correctly.
 */
declare function referencesWithLsp(scan: RepoScan, repo: string, name: string, statik: SymbolReferences, options?: LspQueryOptions): Promise<LspReferences>;
/** Incoming calls may exist even when the static caller index has no entry. */
declare function callersWithLsp<T extends object>(scan: RepoScan, repo: string, name: string, statik: T, options?: LspQueryOptions): Promise<LspCallers<T>>;

declare function spawnLspTransport(server: LspServerConfig, cwd: string): LspTransport | undefined;

type RuleSeverity = "error" | "warn";
interface ForbiddenEdgeRule {
    name: string;
    from: string | string[];
    to: string | string[];
    kind?: EdgeKind[];
    severity?: RuleSeverity;
    comment?: string;
}
interface BuiltinRule {
    name: string;
    builtin: "cycles" | "orphans" | "literals";
    tiers?: LiteralDuplication["tier"][];
    minFiles?: number;
    minCount?: number;
    includeTests?: boolean;
    severity?: RuleSeverity;
    comment?: string;
}
interface CheckRulesOptions {
    scan?: RepoScan;
}
type ArchRule = ForbiddenEdgeRule | BuiltinRule;
interface RuleViolation {
    rule: string;
    from: string;
    to: string;
    kind: EdgeKind | "cycle" | "orphan" | "literal" | "unmatched";
    severity: RuleSeverity;
    comment?: string;
}
declare function parseRules(input: unknown): ArchRule[];
declare function checkRules(graph: Graph, rules: ArchRule[], opts?: CheckRulesOptions): RuleViolation[];

interface ChangeCoupling {
    a: string;
    b: string;
    together: number;
    totalA: number;
    totalB: number;
    strength: number;
    confidence: number;
    linked?: boolean;
}
interface CouplingOptions {
    since?: string;
    maxCommitFiles?: number;
    minTogether?: number;
    maxPairs?: number;
    graph?: Pick<Graph, "files" | "fileEdges">;
    hidden?: boolean;
}
interface CouplingResult {
    ok: boolean;
    error?: string;
    shallow?: boolean;
    couplings: ChangeCoupling[];
}
declare function changeCoupling(dir: string, opts?: CouplingOptions): CouplingResult;
interface Hotspot {
    rel: string;
    lines: number;
    commits: number;
    score: number;
    test?: true;
}
declare function rankHotspots(scan: RepoScan, churn: Map<string, number>, top?: number): Hotspot[];

interface RepoMapOptions {
    budgetTokens?: number;
    maxSymbolsPerFile?: number;
    bare?: boolean;
}
declare function renderRepoMap(scan: RepoScan, graph: Graph, opts?: RepoMapOptions): string;

interface DeadSymbol {
    name: string;
    file: string;
    line: number;
    kind: string;
    tier: "unreferenced" | "uncalled";
}
interface DeadCodeOptions {
    /** "callable" (default): functions, methods, classes, function-valued consts. "all": every exported kind. */
    kinds?: "callable" | "all";
    /** Also report symbols of tail files (examples, docs, fixtures, scripts). Test files stay roots. */
    includeTail?: boolean;
}
declare function findDeadCode(scan: RepoScan, opts?: DeadCodeOptions): DeadSymbol[];

interface LiteralFamily {
    prefix: string;
    members: LiteralDuplication[];
    files: number;
    count: number;
}
interface LiteralsReport {
    duplications: LiteralDuplication[];
    families: LiteralFamily[];
}
interface LiteralsOptions {
    minFiles?: number;
    minCount?: number;
    includeTests?: boolean;
    kinds?: ReadonlySet<CodeLiteral["kind"]>;
}
declare function findLiteralDuplications(scan: RepoScan, opts?: LiteralsOptions): LiteralsReport;

/** Branch count + 1 over the code of `source`, its comments and strings aside. */
declare function complexityOfSource(source: string, lang?: string): number;
interface SymbolComplexity {
    file: string;
    name: string;
    line: number;
    endLine?: number;
    complexity: number;
}
declare function symbolComplexity(scan: RepoScan, rel?: string, top?: number): SymbolComplexity[];
interface RiskHotspot {
    file: string;
    complexity: number;
    commits: number;
    score: number;
}
declare function riskHotspots(scan: RepoScan, churn: Map<string, number>, top?: number): RiskHotspot[];

interface MermaidOptions {
    module?: string;
    maxEdges?: number;
}
declare function renderMermaid(graph: Graph, opts?: MermaidOptions): string;
interface ClusteredMermaidResult {
    content: string;
    shownModules: number;
    totalModules: number;
    shownEdges: number;
    totalEdges: number;
}
interface ClusteredMermaidOptions {
    maxModules?: number;
    maxEdges?: number;
    title?: string;
}
declare function renderMermaidClustered(graph: Graph, opts?: ClusteredMermaidOptions): ClusteredMermaidResult;

declare function hubThreshold(degrees: number[]): number;
interface ImpactedFile {
    rel: string;
    module: string;
    depth: number;
}
interface ImpactResult {
    target: string;
    scope: "module" | "file";
    seeds: string[];
    files: ImpactedFile[];
    modules: string[];
    inferredDependents?: number;
}
interface ClosureOptions {
    /** Leave out `call` edges inferred from a name alone (Edge.confidence "inferred"). */
    skipInferred?: boolean;
    /**
     * Read a Go import as an import of the whole package. Go imports a
     * directory, and the resolver lands it on ONE representative file of it, so
     * without this the other files of a package have no importers at all: gin's
     * render/render.go (the Render interface) showed no dependents while
     * `render` had 61.
     */
    goPackages?: boolean;
}
declare function reverseClosure(edges: Edge[], seeds: string[], depth?: number, opts?: ClosureOptions): Map<string, number>;
interface ImpactOptions {
    /** Also follow `call` edges inferred from a name alone (default false: they are counted, not walked). */
    includeInferred?: boolean;
}
declare function impactOf(graph: Graph, target: string, depth?: number, opts?: ImpactOptions): ImpactResult | undefined;
interface NeighborLink {
    node: string;
    direction: "out" | "in";
    kind: string;
    weight: number;
    depth: number;
    confidence?: "extracted" | "inferred";
}
interface NeighborResult {
    target: string;
    scope: "module" | "file";
    links: NeighborLink[];
    members?: string[];
}
declare function neighborsOf(graph: Graph, target: string, depth?: number, kinds?: Set<string>): NeighborResult | undefined;

interface DeltaOptions {
    base?: string;
    staged?: boolean;
    depth?: number;
    scan?: RepoScan;
    indexDir?: string;
}
interface ChangedSymbol {
    name: string;
    kind: string;
    exported: boolean;
    line: number;
    endLine?: number;
    parent?: string;
    approx?: boolean;
}
interface DeltaChange {
    path: string;
    status: DiffFile["status"];
    oldPath?: string;
    binary?: boolean;
    linesAdded?: number;
    linesDeleted?: number;
    module?: string;
    hunks: {
        start: number;
        end: number;
    }[];
    symbols: ChangedSymbol[];
}
interface DeltaModule {
    slug: string;
    path: string;
    score: number;
    bucket: "HIGH" | "MEDIUM" | "LOW";
    reasons: string[];
    changedFiles: string[];
    changedSymbols: {
        total: number;
        exported: number;
    };
    impact: {
        directFiles: number;
        transitiveFiles: number;
        modules: string[];
    };
    tests: {
        status: "covered" | "gap" | "n/a";
        files: string[];
    };
    open: string[];
}
interface BrokenImport {
    from: string;
    spec: string;
    kind: "import" | "doc-link";
    target: string;
    renamedTo?: string;
}
interface DeltaResult {
    base: {
        ref: string;
        mergeBase: string;
        staged: boolean;
    };
    indexCommit?: string;
    depth: number;
    changes: DeltaChange[];
    modules: DeltaModule[];
    dangling: {
        from: string;
        spec: string;
        reason: string;
    }[];
    broken: BrokenImport[];
    deleted: string[];
    unindexed: string[];
    notes: string[];
}
type DeltaError = {
    error: string;
};
declare const RISK_WEIGHTS: {
    readonly exportedChange: 25;
    readonly hubHigh: 20;
    readonly hubMed: 10;
    readonly blastHigh: 20;
    readonly blastMed: 10;
    readonly testGap: 20;
    readonly surprise: 10;
    readonly dangling: 15;
    readonly brokenImport: 40;
};
declare const DEFAULT_DELTA_DEPTH = 2;
interface NamedDef {
    name: string;
    file: string;
    line: number;
    endLine?: number;
    kind: string;
    exported: boolean;
    parent?: string;
}
declare function symbolsInHunks(defs: NamedDef[], hunks: Hunk[]): ChangedSymbol[];
declare function brokenImports(scan: RepoScan, graph: Graph, removed: {
    path: string;
    renamedTo?: string;
}[]): BrokenImport[];
declare function computeDelta(graph: Graph, symbols: SymbolIndex | undefined, diff: {
    files: DiffFile[];
    hunks: Map<string, Hunk[]>;
    base: DeltaResult["base"];
    notes?: string[];
    broken?: BrokenImport[];
}, depth?: number): DeltaResult;
interface DeltaDiff {
    base: DeltaResult["base"];
    files: DiffFile[];
    hunks: Map<string, Hunk[]>;
    notes: string[];
}
declare function readDeltaDiff(repo: string, opts?: DeltaOptions): DeltaDiff | DeltaError;
declare function emptyDelta(diff: DeltaDiff, depth?: number): DeltaResult;
declare function deltaOfDiff(diff: DeltaDiff, graph: Graph, symbols: SymbolIndex | undefined, opts?: DeltaOptions): DeltaResult;
declare function deltaFor(repo: string, graph: Graph, symbols: SymbolIndex | undefined, opts?: DeltaOptions): DeltaResult | DeltaError;
declare function formatDeltaPanel(res: DeltaResult): string;

interface McpServerOptions {
    serverInfo?: {
        name?: string;
        version?: string;
    };
    defaultRepo?: string;
    maxResponseBytes?: number;
    profile?: string;
    watch?: boolean;
}
declare function runMcpServer(opts?: McpServerOptions): Promise<void>;

declare function rewriteCommand(cmd: string, bin?: string): string | undefined;

declare function sha1(s: string | Uint8Array): string;
declare function shortHash(s: string, n?: number): string;

declare function byStr(a: string, b: string): number;
declare function byKey<T>(keyOf: (x: T) => string): (a: T, b: T) => number;

declare function runCli(rawArgv: string[]): Promise<void>;

export { type ArchRule, BINARY_EXT, type BrokenImport, type BuildIndexOptions, type BuiltinRule, CORE_GRAMMARS, type CallerEntry, type CallerIndex, type CallerIndexOptions, type CallerSite, type ChangeCoupling, type ChangedSymbol, type ClusteredMermaidOptions, type ClusteredMermaidResult, type CodeInfo, type CodeLiteral, type CodeSymbol, type CouplingOptions, DEFAULT_DELTA_DEPTH, DEFAULT_GRAMMARS_URL, DEFAULT_MAX_FILES, type DeadCodeOptions, type DeadSymbol, type DeltaChange, type DeltaDiff, type DeltaError, type DeltaModule, type DeltaOptions, type DeltaResult, type DiffFile, type DiffSpec, type Direction, EMBED_VERSION, ENGINE_VERSION, EXTENDED_GRAMMARS, EXTRACTOR_VERSION, EXT_GRAMMAR, type Edge, type EdgeKind, type EditResult, type EmbedEndpointOptions, type EmbedPullTarget, type EmbeddingIndex, type EmbeddingRecord, type EmbeddingUnit, type Encoding, type ExplainedSearch, type ExplainedSemanticSearch, type ExtractedRecord, type FileCategory, type FileKind, type FileNode, type FileRecord, type FindSymbolOptions, type ForbiddenEdgeRule, type GrammarsPullResult, type GrammarsPullTarget, type GrammarsTier, type GrammarsTierName, type Graph, type GrepOptions, type GrepResult, type HierarchyRef, type Hotspot, type Hunk, IGNORE_DIRS, INDEX_DIR, type IgnoreRule, type ImpactResult, type ImpactedFile, type IndexArtifacts, type IndexStaleness, type IndexStatus, type IndexStatusOptions, LOCKFILES, type LiteralDuplication, type LiteralFamily, type LiteralSite, type LiteralsOptions, type LiteralsReport, type LspAgreement, type LspBlock, type LspCallers, type LspCallersBlock, type LspCapabilities, type LspConfig, type LspConfigSource, type LspIncomingCall, type LspMessage, type LspQueryOptions, type LspRef, type LspReferences, type LspServerConfig, type LspServerStatus, type LspSession, type LspSessionOptions, LspSessionPool, type LspStatus, LspTimeout, type LspTransport, MARKDOWN_EXT, MAX_FRAME_BYTES, type MarkdownInfo, type McpServerOptions, type MermaidOptions, type ModuleInfo, type ModuleNode, type NeighborLink, type NeighborResult, type Neighborhood, OffsetMap, type OnboardBrief, type OnboardOptions, type PathVerdict, type PathVerdictReason, type PersistedCacheEntry, type PersistedCacheMap, type PersistedMeta, type QueryExplanation, type QueryVerdict, RISK_WEIGHTS, type RawCallerIndex, type RawCallerSite, type RawRef, type RawRelation, type RenderScipOptions, type RepoMapOptions, type RepoScan, type Resolution, type ResolveContext, type ResolvedRelation, type RiskHotspot, type RuleSeverity, type RuleViolation, SCHEMA_VERSION, type ScanOptions, type ScanSkip, type ScanSummary, type SearchHit, type SearchOptions, type SearchResult, type SemanticQueryExplanation, type SemanticSearchOptions, type SemanticSearchResult, type ShResult, type StaticEmbedModel, type SurpriseEdge, type SymbolComplexity, type SymbolEdge, type SymbolEdgeKind, type SymbolGraph, type SymbolIndex, type SymbolMatch, type SymbolNode, type SymbolReferences, type TagDefinition, type TagsQueryStatus, type TermDiagnostic, type TestMap, type TextRead, type Tier, type TypeHierarchyEntry, type UnusableIndex, type WalkEntry, type WalkOptions, type WalkResult, type WalkSkip, type WalkedFile, type WarmGrammarsOptions, type WarmGrammarsResult, type WorkspaceInfo, type WorkspaceKind, type WorkspacePackage, agreementOf, allGrammarKeys, applyCentrality, basicTokenize, betweennessOf, brokenImports, buildArtifactsFromScan, buildCallerIndex, buildCodeRecord, buildEmbeddingIndex, buildEndpointIndex, buildGraph, buildIndexArtifacts, buildModules, buildRawCallerIndex, buildResolveContext, buildSymbolGraph, buildSymbolIndex, buildTypeHierarchy, byKey, byStr, callersWithLsp, categorize, changeCoupling, changedSince, checkRules, classify, clip, clipInline, columnOfSymbol, communityOf, compileGlobs, complexityOfSource, computeDelta, computeImportPairs, computeSurprises, computeSymbolRefs, computeTestMap, createFramer, decidingRule, deleteMemory, deltaFor, deltaOfDiff, deserializeEmbeddings, detectCommunities, detectWorkspaces, diffFiles, diffHunks, embedEndpointUrl, embedViaEndpoint, embeddingUnits, emptyDelta, enclosingSymbol, encode, encodeMessage, encodeQueryViaEndpoint, endpointModelId, ensureGrammars, escapeRegExp, explainQuery, explainSemantic, extToLang, extractAst, extractCode, extractGrammarsTarball, extractInParallel, extractMarkdown, extractRst, extractSymbols, extractTags, extractTarInto, fetchExpectedSha256, fetchGrammarsTarball, fileUri, findDeadCode, findLiteralDuplications, findReferences, findSymbol, foldText, formatDeltaPanel, gitChurn, grammarKeyForExt, grammarKeysForExts, grammarReady, grepRepo, grepRepoEx, hasEmbedModel, have, headCommit, healthzUrl, hubThreshold, impactOf, implementationsOf, indexStatus, insertAfterSymbol, insertBeforeSymbol, intDot, isCode, isDoc, isGitWorktree, isIgnored, isSurprising, isTestFile, isTestPath, keptCodeFiles, keywords, languageOf, listMemories, loadEmbedModel, loadLspConfig, locationsToRefs, lspStatus, lspUnavailable, neighborhood, neighborsOf, onboardBrief, openLspSession, pagerankOf, parseGitignore, parseLspConfig, parseRules, preloadArtifacts, preloadSession, probeEndpoint, pullGrammars, quantize, rankHotspots, rankedKeywords, readDeltaDiff, readMemory, readPersistedIndex, readText, readTextEx, referencesWithLsp, relFromUri, renderGraphJson, renderMermaid, renderMermaidClustered, renderRepoMap, renderScip, renderSymbolsJson, replaceSymbolBody, resolveBaseRef, resolveCallEdges, resolveDocLink, resolveEmbedEndpoint, resolveEmbedModelDir, resolveEmbedPullUrl, resolveGrammarsDir, resolveGrammarsPullTarget, resolveGrammarsTier, resolveImport, resolveLspConfigPath, resolveRelationEdges, resolveRelations, resolveUniqueSymbol, reverseClosure, rewriteCommand, riskHotspots, roundHalfToEven, rrf, runCli, runExtractWorker, runMcpServer, scanRepo, scanRepoParallel, scanSkips, scanSummary, searchIndex, searchSemantic, serializeEmbeddings, serverForLang, sh, sha1, sharedGrammarsCacheDir, shortHash, skipHistogram, slugify, spawnLspTransport, subtokens, symbolComplexity, symbolId, symbolsInHunks, symbolsOverview, tagsQueryStatus, testsForModule, tierForPath, toCacheMap, tokenize, typeEntry, uniqueSymbolDefs, unitHash, untestedModules, untrackedFiles, walk, warmGrammars, whyPath, wordpiece, workerCount, writeMemory };
