declare const ENGINE_VERSION = "2.12.0";
declare const SCHEMA_VERSION = 4;
declare const EXTRACTOR_VERSION = 9;
type FileKind = "code" | "doc" | "config" | "asset" | "other";
type EdgeKind = "contains" | "doc-link" | "import" | "call" | "use" | "mention";
type Tier = 0 | 1 | 2;
interface CodeSymbol {
    name: string;
    kind: string;
    file: string;
    line: number;
    endLine?: number;
    parent?: string;
    signature?: string;
    exported: boolean;
    lang: string;
}
interface RawRef {
    kind: "doc-link" | "import";
    spec: string;
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

interface WalkOptions {
    maxFileBytes?: number;
    maxFiles?: number;
    gitignore?: boolean;
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
}
interface ScanOptions {
    include?: string[];
    exclude?: string[];
    scope?: string;
    gitignore?: boolean;
    maxBytes?: number;
    maxFiles?: number;
    out?: string;
    cache?: Map<string, {
        hash: string;
        record: FileRecord;
        size?: number;
        mtimeMs?: number;
    }>;
    fullHash?: boolean;
}
declare function scanRepo(root: string, opts?: ScanOptions): RepoScan;

declare function compileGlobs(globs: string[] | undefined): ((rel: string) => boolean) | null;

interface IgnoreRule {
    re: RegExp;
    negated: boolean;
    dirOnly: boolean;
}
declare function parseGitignore(content: string, baseRel: string): IgnoreRule[];
declare function isIgnored(rules: readonly IgnoreRule[], rel: string, isDir: boolean): boolean;

declare const MARKDOWN_EXT: Set<string>;
declare function isDoc(rel: string, ext: string): boolean;
declare function isCode(ext: string): boolean;
declare function classify(rel: string, ext: string): FileKind;

type FileCategory = "code" | "test" | "config" | "schema" | "i18n" | "doc" | "style" | "asset" | "data" | "other";
declare function categorize(rel: string, ext: string): FileCategory;

declare function extToLang(ext: string): string;

declare function extractSymbols(rel: string, ext: string, content: string): CodeSymbol[];
declare function languageOf(ext: string): string;

interface CodeInfo {
    symbols: CodeSymbol[];
    summary?: string;
    refs: RawRef[];
    pkg?: string;
    idents?: string[];
    calls?: {
        name: string;
        line: number;
        receiver?: string;
    }[];
    importedNames?: string[];
}
declare function extractCode(rel: string, ext: string, content: string): CodeInfo;

interface MarkdownInfo {
    title?: string;
    summary?: string;
    headings: string[];
    refs: RawRef[];
}
declare function extractMarkdown(content: string): MarkdownInfo;

declare function grammarKeyForExt(ext: string): string | undefined;
declare function ensureGrammars(keys: Iterable<string>): Promise<void>;
declare function allGrammarKeys(): string[];
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
}
declare function extractAst(rel: string, ext: string, content: string): AstResult | undefined;

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
    cIncludeRoots: string[];
    rubyLibRoots: string[];
    phpPsr4: {
        prefix: string;
        dir: string;
    }[];
    csharpNamespaces: Map<string, string[]>;
    warnings: string[];
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

declare function resolveCallEdges(scan: RepoScan, importPairs: Set<string>): Edge[];

interface CallerSite {
    file: string;
    line: number;
    confidence?: "corroborated" | "unique-name";
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
}
declare function findSymbol(scan: RepoScan, namePath: string, opts?: FindSymbolOptions): SymbolMatch[];
interface SymbolReferences {
    defs: CodeSymbol[];
    callSites: CallerSite[];
    referencingFiles: string[];
}
declare function findReferences(scan: RepoScan, name: string): SymbolReferences;

interface EditResult {
    file: string;
    startLine: number;
    endLine: number;
    lines: number;
}
declare function resolveUniqueSymbol(scan: RepoScan, namePath: string, file?: string): CodeSymbol;
declare function replaceSymbolBody(scan: RepoScan, namePath: string, body: string, file?: string): EditResult;
declare function insertAfterSymbol(scan: RepoScan, namePath: string, body: string, file?: string): EditResult;
declare function insertBeforeSymbol(scan: RepoScan, namePath: string, body: string, file?: string): EditResult;

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
declare function buildSymbolIndex(scan: RepoScan, refs?: Map<string, Set<string>>): SymbolIndex;
declare function renderSymbolsJson(index: SymbolIndex): string;

declare function renderGraphJson(graph: Graph): string;

interface RenderScipOptions {
    projectRoot?: string;
    toolVersion?: string;
}
declare function renderScip(scan: RepoScan, opts?: RenderScipOptions): Uint8Array;

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
declare function gitChurn(dir: string, opts?: {
    since?: string;
}): {
    churn: Map<string, number>;
    ok: boolean;
};
declare function changedSince(dir: string, ref: string): Set<string>;

interface SearchHit {
    file: string;
    line: number;
    text: string;
}
interface GrepOptions {
    globs?: string[];
    maxHits?: number;
    ignoreCase?: boolean;
    noRipgrep?: boolean;
}
declare function grepRepo(root: string, pattern: string, opts?: GrepOptions): SearchHit[];

interface SearchOptions {
    limit?: number;
    fuzzy?: boolean;
}
interface SearchResult {
    file: string;
    score: number;
    matchedTerms: string[];
    topSymbols: string[];
    fuzzyTerms?: string[];
}
declare function subtokens(raw: string): string[];
declare function searchIndex(scan: RepoScan, query: string, opts?: SearchOptions): SearchResult[];

declare const EMBED_VERSION = 1;
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
declare function embeddingUnits(scan: RepoScan): EmbeddingUnit[];
declare function buildEmbeddingIndex(scan: RepoScan, model: StaticEmbedModel): EmbeddingIndex;
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
declare function searchSemantic(scan: RepoScan, query: string, index: EmbeddingIndex | undefined, opts?: SemanticSearchOptions): SemanticSearchResult[];

interface EmbedEndpointOptions {
    url?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
    batchSize?: number;
}
declare function resolveEmbedEndpoint(opts?: EmbedEndpointOptions): string | undefined;
declare function embedEndpointUrl(base: string): string;
declare function healthzUrl(base: string): string;
declare function embedViaEndpoint(texts: string[], opts?: EmbedEndpointOptions): Promise<number[][]>;
declare function probeEndpoint(base: string, opts?: EmbedEndpointOptions): Promise<boolean>;
declare function encodeQueryViaEndpoint(query: string, opts?: EmbedEndpointOptions): Promise<Int8Array>;
declare function buildEndpointIndex(scan: RepoScan, opts?: EmbedEndpointOptions): Promise<EmbeddingIndex>;

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
    builtin: "cycles" | "orphans";
    severity?: RuleSeverity;
    comment?: string;
}
type ArchRule = ForbiddenEdgeRule | BuiltinRule;
interface RuleViolation {
    rule: string;
    from: string;
    to: string;
    kind: EdgeKind | "cycle" | "orphan";
    severity: RuleSeverity;
    comment?: string;
}
declare function parseRules(input: unknown): ArchRule[];
declare function checkRules(graph: Graph, rules: ArchRule[]): RuleViolation[];

interface ChangeCoupling {
    a: string;
    b: string;
    together: number;
    totalA: number;
    totalB: number;
    strength: number;
}
interface CouplingOptions {
    since?: string;
    maxCommitFiles?: number;
    minTogether?: number;
    maxPairs?: number;
}
declare function changeCoupling(dir: string, opts?: CouplingOptions): {
    ok: boolean;
    couplings: ChangeCoupling[];
};
interface Hotspot {
    rel: string;
    lines: number;
    commits: number;
    score: number;
}
declare function rankHotspots(scan: RepoScan, churn: Map<string, number>, top?: number): Hotspot[];

interface RepoMapOptions {
    budgetTokens?: number;
    maxSymbolsPerFile?: number;
}
declare function renderRepoMap(scan: RepoScan, graph: Graph, opts?: RepoMapOptions): string;

interface DeadSymbol {
    name: string;
    file: string;
    line: number;
    kind: string;
    tier: "unreferenced" | "uncalled";
}
declare function findDeadCode(scan: RepoScan): DeadSymbol[];

declare function complexityOfSource(source: string): number;
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

declare function runMcpServer(): Promise<void>;

declare function sha1(s: string): string;
declare function shortHash(s: string, n?: number): string;

declare function byStr(a: string, b: string): number;
declare function byKey<T>(keyOf: (x: T) => string): (a: T, b: T) => number;

interface ShResult {
    ok: boolean;
    status: number | null;
    stdout: string;
    stderr: string;
    missing: boolean;
}
declare function sh(cmd: string, args: string[], opts?: {
    cwd?: string;
    input?: string;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
}): ShResult;
declare function have(cmd: string): boolean;
declare function slugify(input: string): string;
declare function clip(s: string, max: number): string;
declare function clipInline(s: string, max: number): string;
declare function escapeRegExp(s: string): string;
declare function foldText(s: string): string;
declare function keywords(question: string): string[];
declare function rankedKeywords(question: string): string[];
declare function rrf<T>(lists: T[][], keyOf: (item: T) => string, k?: number): Map<string, number>;

declare function runCli(argv: string[]): Promise<void>;

export { type ArchRule, type BuildIndexOptions, type BuiltinRule, type CallerEntry, type CallerIndex, type CallerIndexOptions, type CallerSite, type ChangeCoupling, type CodeInfo, type CodeSymbol, type CouplingOptions, DEFAULT_MAX_FILES, type DeadSymbol, type DiffFile, type DiffSpec, EMBED_VERSION, ENGINE_VERSION, EXTRACTOR_VERSION, type Edge, type EdgeKind, type EditResult, type EmbedEndpointOptions, type EmbeddingIndex, type EmbeddingRecord, type EmbeddingUnit, type FileCategory, type FileKind, type FileNode, type FileRecord, type FindSymbolOptions, type ForbiddenEdgeRule, type Graph, type GrepOptions, type Hotspot, type Hunk, type IgnoreRule, type IndexArtifacts, MARKDOWN_EXT, type MarkdownInfo, type MermaidOptions, type ModuleInfo, type ModuleNode, type RawCallerIndex, type RawCallerSite, type RawRef, type RenderScipOptions, type RepoMapOptions, type RepoScan, type Resolution, type ResolveContext, type RiskHotspot, type RuleSeverity, type RuleViolation, SCHEMA_VERSION, type ScanOptions, type SearchHit, type SearchOptions, type SearchResult, type SemanticSearchOptions, type SemanticSearchResult, type ShResult, type StaticEmbedModel, type SurpriseEdge, type SymbolComplexity, type SymbolIndex, type SymbolMatch, type SymbolReferences, type TestMap, type Tier, type WalkOptions, type WalkResult, type WalkedFile, type WorkspaceInfo, type WorkspaceKind, type WorkspacePackage, allGrammarKeys, applyCentrality, basicTokenize, betweennessOf, buildCallerIndex, buildEmbeddingIndex, buildEndpointIndex, buildGraph, buildIndexArtifacts, buildModules, buildRawCallerIndex, buildResolveContext, buildSymbolIndex, byKey, byStr, categorize, changeCoupling, changedSince, checkRules, classify, clip, clipInline, communityOf, compileGlobs, complexityOfSource, computeImportPairs, computeSurprises, computeSymbolRefs, computeTestMap, deleteMemory, deserializeEmbeddings, detectCommunities, detectWorkspaces, diffFiles, diffHunks, embedEndpointUrl, embedViaEndpoint, embeddingUnits, enclosingSymbol, encode, encodeQueryViaEndpoint, ensureGrammars, escapeRegExp, extToLang, extractAst, extractCode, extractMarkdown, extractSymbols, findDeadCode, findReferences, findSymbol, foldText, gitChurn, grammarKeyForExt, grammarReady, grepRepo, hasEmbedModel, have, headCommit, healthzUrl, insertAfterSymbol, insertBeforeSymbol, intDot, isCode, isDoc, isGitWorktree, isIgnored, isSurprising, isTestFile, isTestPath, keywords, languageOf, listMemories, loadEmbedModel, pagerankOf, parseGitignore, parseRules, probeEndpoint, quantize, rankHotspots, rankedKeywords, readMemory, readText, renderGraphJson, renderMermaid, renderRepoMap, renderScip, renderSymbolsJson, replaceSymbolBody, resolveBaseRef, resolveCallEdges, resolveDocLink, resolveEmbedEndpoint, resolveEmbedModelDir, resolveEmbedPullUrl, resolveImport, resolveUniqueSymbol, riskHotspots, roundHalfToEven, rrf, runCli, runMcpServer, scanRepo, searchIndex, searchSemantic, serializeEmbeddings, sh, sha1, shortHash, slugify, subtokens, symbolComplexity, symbolsOverview, testsForModule, tierForPath, tokenize, uniqueSymbolDefs, untestedModules, untrackedFiles, walk, wordpiece, writeMemory };
