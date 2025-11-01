const {
  AppBar,
  Toolbar,
  Typography,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Avatar,
  LinearProgress,
  Tooltip,
  Fade,
  Paper,
  ListItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  useMediaQuery,
} = MaterialUI;

const {
  MenuRounded,
  RefreshRounded,
  WarningAmberRounded,
  TaskAltRounded,
  BoltRounded,
  InsightsRounded,
  LocationOnRounded,
  GroupRounded,
  MapRounded,
  LayersRounded,
  AddRounded,
  RemoveRounded,
} = MaterialUIIcons;

const STATUS_COLORS = {
  Excellent: "#4caf50",
  Good: "#66bb6a",
  Warning: "#ffa726",
  Critical: "#ef5350",
};

const STATUS_EMOJI = {
  Excellent: "💡",
  Good: "✅",
  Warning: "⚠️",
  Critical: "🚨",
};

const formatDate = (isoString) => {
  if (!isoString) {
    return "";
  }
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const FloatingPanel = ({ title, subtitle, icon: Icon, tone, chip, children }) => (
  <Paper
    elevation={8}
    sx={{
      width: { xs: "100%", sm: 300 },
      borderRadius: 3,
      p: 2,
      backdropFilter: "blur(12px)",
      bgcolor: (theme) => `${theme.palette.background.paper}CC`,
      boxShadow: (theme) => `0 24px 60px ${theme.palette.grey[900]}20`,
    }}
  >
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
      <Avatar sx={{ bgcolor: tone, width: 36, height: 36 }}>
        <Icon fontSize="small" />
      </Avatar>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {chip}
    </Stack>
    <Box sx={{ display: "grid", gap: 1.5 }}>{children}</Box>
  </Paper>
);

const AssetMarker = ({ asset, selected, onSelect }) => {
  const color = STATUS_COLORS[asset.status] || "#90caf9";
  return (
    <Fade in timeout={500}>
      <Box
        className={`asset-marker ${asset.status === "Critical" ? "critical-glow" : asset.status === "Warning" ? "warning-glow" : ""}`}
        onClick={() => onSelect(asset)}
        sx={{
          position: "absolute",
          left: `${asset.x}px`,
          top: `${asset.y}px`,
          transform: "translate(-50%, -50%)",
          width: selected ? 30 : 24,
          height: selected ? 30 : 24,
          borderRadius: "50%",
          border: (theme) => `2px solid ${theme.palette.background.paper}`,
          bgcolor: color,
          cursor: "pointer",
          transition: "all 0.25s ease",
          boxShadow: selected
            ? "0 0 0 6px rgba(103, 58, 183, 0.25)"
            : "0 10px 24px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "0.7rem",
          fontWeight: 700,
        }}
      >
        {STATUS_EMOJI[asset.status] || "⬤"}
      </Box>
    </Fade>
  );
};

const CrewMarker = ({ crew }) => (
  <Fade in timeout={500}>
    <Box
      className="crew-marker"
      sx={{
        position: "absolute",
        left: `${crew.x}px`,
        top: `${crew.y}px`,
        transform: "translate(-50%, -50%) rotate(45deg)",
        width: 26,
        height: 26,
        borderRadius: 1,
        bgcolor: "#29b6f6",
        border: "2px solid #fff",
        boxShadow: "0 8px 16px rgba(41,182,246,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#0d47a1",
        fontSize: "0.65rem",
        fontWeight: 700,
      }}
    >
      🚚
    </Box>
  </Fade>
);

const MapSimulation = ({ assets, crews, routes, onSelectAsset, selectedAssetId }) => {
  const theme = useTheme();
  const containerRef = React.useRef(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const [lastPoint, setLastPoint] = React.useState(null);

  const clampZoom = (value) => Math.min(2.4, Math.max(0.75, value));

  const handleWheel = React.useCallback(
    (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.12 : -0.12;
      setZoom((prev) => clampZoom(prev + delta));
    },
    []
  );

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = (event) => {
    event.preventDefault();
    setDragging(true);
    setLastPoint({ x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging || !lastPoint) return;
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPoint({ x: event.clientX, y: event.clientY });
  };

  const stopDragging = (event) => {
    setDragging(false);
    setLastPoint(null);
    event?.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        ref={containerRef}
        className="simulated-map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: 360, md: 520 },
          overflow: "hidden",
          borderRadius: 4,
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: `0 24px 60px ${theme.palette.grey[900]}14`,
          bgcolor: theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(90deg, rgba(120,144,156,0.12) 1px, transparent 1px)," +
              "linear-gradient(0deg, rgba(120,144,156,0.12) 1px, transparent 1px)",
            backgroundSize: `${80}px ${80}px`,
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 1000,
            height: 700,
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "center",
            transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.33,1,0.68,1)",
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 1000 700"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {Object.entries(routes || {}).map(([crewId, points]) => (
              <polyline
                key={crewId}
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#26c6da"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.45}
              />
            ))}
          </Box>
          {assets.map((asset) => (
            <Tooltip
              key={asset.id}
              title={`${asset.name} • ${asset.status}`}
              placement="top"
              arrow
            >
              <Box>
                <AssetMarker
                  asset={asset}
                  selected={asset.id === selectedAssetId}
                  onSelect={onSelectAsset}
                />
              </Box>
            </Tooltip>
          ))}
          {crews.map((crew) => (
            <Tooltip
              key={crew.id}
              title={`${crew.name} • ${crew.status}`}
              arrow
              placement="top"
            >
              <Box>
                <CrewMarker crew={crew} />
              </Box>
            </Tooltip>
          ))}
        </Box>
        <Stack
          spacing={1}
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            bgcolor: `${theme.palette.background.paper}E6`,
            borderRadius: 2,
            boxShadow: `0 12px 32px ${theme.palette.grey[900]}30`,
            p: 1,
            backdropFilter: "blur(8px)",
          }}
        >
          <Tooltip title="Zoom in">
            <IconButton
              size="small"
              onClick={() => setZoom((prev) => clampZoom(prev + 0.18))}
            >
              <AddRounded fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom out">
            <IconButton
              size="small"
              onClick={() => setZoom((prev) => clampZoom(prev - 0.18))}
            >
              <RemoveRounded fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset view">
            <IconButton size="small" onClick={resetView}>
              <MapRounded fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box
          sx={{
            position: "absolute",
            left: 24,
            bottom: 24,
            px: 2.5,
            py: 1.2,
            borderRadius: 999,
            bgcolor: `${theme.palette.background.paper}D6`,
            boxShadow: `0 12px 30px ${theme.palette.grey[900]}22`,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            backdropFilter: "blur(10px)",
          }}
        >
          {Object.entries(STATUS_COLORS).map(([label, color]) => (
            <Stack key={label} direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: color,
                  boxShadow: `0 0 0 3px ${theme.palette.background.paper}`,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

const AssetDialog = ({ asset, onClose }) => (
  <Dialog open={Boolean(asset)} onClose={onClose} maxWidth="sm" fullWidth>
    {asset && (
      <>
        <DialogTitle>{asset.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`${asset.status} • Health ${asset.health_score}`}
                sx={{ bgcolor: `${STATUS_COLORS[asset.status]}22` }}
                icon={<InsightsRounded />}
              />
              <Chip
                label={`Risk ${asset.risk_score}`}
                color="warning"
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Region: {asset.region}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Type: {asset.type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last service: {formatDate(asset.last_service)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Next service: {formatDate(asset.next_service)}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </>
    )}
  </Dialog>
);

const Sidebar = ({ assets = [], open, onToggle, variant }) => {
  const categories = Array.from(
    assets.reduce((map, asset) => {
      map.set(asset.type, (map.get(asset.type) || 0) + 1);
      return map;
    }, new Map())
  );

  return (
    <Drawer
      variant={variant}
      open={variant === "temporary" ? open : true}
      onClose={variant === "temporary" ? onToggle : undefined}
      ModalProps={variant === "temporary" ? { keepMounted: true } : undefined}
      sx={{
        width: 280,
        flexShrink: 0,
        display: variant === "temporary" && !open ? "none" : "block",
        [`& .MuiDrawer-paper`]: {
          width: 280,
          boxSizing: "border-box",
          borderRight: "none",
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
          color: "#e2e8f0",
          backdropFilter: "blur(8px)",
        },
      }}
    >
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", px: 2 }}>
        <Typography variant="subtitle2" sx={{ letterSpacing: 1.2 }}>
          Filters
        </Typography>
        {variant === "temporary" && (
          <IconButton color="inherit" size="small" onClick={onToggle}>
            <MenuRounded />
          </IconButton>
        )}
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton sx={{ borderRadius: 2, mb: 1 }}>
            <ListItemIcon sx={{ color: "#38bdf8" }}>
              <LayersRounded />
            </ListItemIcon>
            <ListItemText
              primary="All Assets"
              secondary={`${assets.length} monitored`}
              primaryTypographyProps={{ sx: { color: "#e2e8f0" } }}
              secondaryTypographyProps={{ sx: { color: "#94a3b8" } }}
            />
          </ListItemButton>
        </ListItem>
        {categories.map(([type, count]) => (
          <ListItem disablePadding key={type}>
            <ListItemButton sx={{ borderRadius: 2, mb: 0.5 }}>
              <ListItemIcon sx={{ color: "#fbbf24" }}>
                <BoltRounded />
              </ListItemIcon>
              <ListItemText
                primary={type}
                secondary={`${count} assets`}
                primaryTypographyProps={{ sx: { color: "#f8fafc" } }}
                secondaryTypographyProps={{ sx: { color: "#94a3b8" } }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ mt: "auto", p: 3 }}>
        <Stack spacing={1.2}>
          <Chip
            label="✅ Live"
            sx={{ bgcolor: "rgba(74, 222, 128, 0.16)", color: "#bbf7d0" }}
          />
          <Chip
            label="⚠️ Alerts"
            sx={{ bgcolor: "rgba(251, 191, 36, 0.16)", color: "#fde68a" }}
          />
          <Chip
            label="🧠 AI Insights"
            sx={{ bgcolor: "rgba(125, 211, 252, 0.16)", color: "#bae6fd" }}
          />
        </Stack>
      </Box>
    </Drawer>
  );
};

const FloatingPanels = ({ assets = [], priorities = [], crews = [] }) => {
  const topPriorities = priorities.slice(0, 4);
  const statusCounts = Object.entries(
    assets.reduce((acc, asset) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1;
      return acc;
    }, {})
  );

  return (
    <Stack
      spacing={2}
      sx={{
        position: "absolute",
        top: { xs: "unset", md: 24 },
        bottom: { xs: 24, md: "unset" },
        right: 24,
        left: { xs: 24, md: "unset" },
        width: { xs: "auto", md: 320 },
        zIndex: 2,
      }}
    >
      <FloatingPanel
        title="Asset Focus"
        subtitle="Highest risk equipment"
        icon={LocationOnRounded}
        tone="#6366f1"
        chip={<Chip label="⚠️ Alert" size="small" color="warning" />}
      >
        {topPriorities.length ? (
          topPriorities.map((item) => (
            <Stack key={item.asset_id} spacing={0.5}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.rank}. {item.name}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, item.risk_score)}
                sx={{ borderRadius: 999, height: 6 }}
              />
            </Stack>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            Awaiting prioritized assets
          </Typography>
        )}
      </FloatingPanel>

      <FloatingPanel
        title="Asset Snapshot"
        subtitle="Health distribution"
        icon={InsightsRounded}
        tone="#10b981"
        chip={<Chip label="✅ Live" size="small" color="success" />}
      >
        {statusCounts.length ? (
          <Stack spacing={1.5}>
            {statusCounts.map(([status, count]) => (
              <Stack direction="row" spacing={1.5} alignItems="center" key={status}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: STATUS_COLORS[status],
                    boxShadow: `0 0 0 3px rgba(255,255,255,0.5)`,
                  }}
                />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {status}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Asset telemetry warming up
          </Typography>
        )}
      </FloatingPanel>

      <FloatingPanel
        title="Crew Status"
        subtitle="Assignments in motion"
        icon={GroupRounded}
        tone="#0ea5e9"
        chip={<Chip label="🧠 AI" size="small" color="info" />}
      >
        {crews.length ? (
          crews.map((crew) => (
            <Stack key={crew.id} spacing={0.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {crew.name}
                </Typography>
                <Chip label={crew.status} size="small" variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Next stop: {crew.next_tasks?.[0]?.asset_name || "TBD"} • ETA {formatDate(crew.next_tasks?.[0]?.eta)}
              </Typography>
            </Stack>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            Crew telemetry synchronizing
          </Typography>
        )}
      </FloatingPanel>
    </Stack>
  );
};

const AppContent = () => {
  const theme = useTheme();
  const isMediumDown = useMediaQuery(theme.breakpoints.down("lg"));
  const [drawerOpen, setDrawerOpen] = React.useState(!isMediumDown);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState({
    assets: [],
    crews: [],
    priorities: [],
    spares: [],
    failures: [],
    routes: {},
    generated_at: null,
  });
  const [selectedAsset, setSelectedAsset] = React.useState(null);

  React.useEffect(() => {
    setDrawerOpen(!isMediumDown);
  }, [isMediumDown]);

  const drawerVariant = isMediumDown ? "temporary" : "permanent";

  const loadData = React.useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(refresh ? "/api/refresh" : "/api/dashboard", {
        method: refresh ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Unable to fetch dashboard data");
      }
      const payload = await response.json();
      setData(payload);
      setLoading(false);
      return payload;
    } catch (err) {
      setError(err.message || "Failed to load data");
      setLoading(false);
      return null;
    }
  }, []);

  React.useEffect(() => {
    loadData(false);
  }, [loadData]);

  const toggleDrawer = () => setDrawerOpen((prev) => !prev);
  const handleRefresh = async () => {
    const updated = await loadData(true);
    if (updated) {
      setSelectedAsset(null);
    }
  };

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar
        assets={data.assets}
        open={drawerOpen}
        onToggle={toggleDrawer}
        variant={drawerVariant}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          bgcolor: theme.palette.grey[100],
        }}
      >
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            backdropFilter: "blur(12px)",
            bgcolor: `${theme.palette.background.paper}F2`,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <IconButton
              color="primary"
              onClick={toggleDrawer}
              sx={{ display: { lg: "none" } }}
            >
              <MenuRounded />
            </IconButton>
            <Stack spacing={0.2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Utility Maintenance Control Tower
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Operational intelligence for grid reliability
              </Typography>
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {loading && <CircularProgress size={22} />}
              <Chip
                icon={<TaskAltRounded />}
                label={data.generated_at ? `Updated ${formatDate(data.generated_at)}` : "Loading"}
                variant="outlined"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshRounded />}
                onClick={handleRefresh}
              >
                Refresh data
              </Button>
            </Stack>
          </Toolbar>
          {loading && <LinearProgress />}
        </AppBar>
        <Box sx={{ p: { xs: 2.5, md: 4 }, position: "relative" }}>
          {error && (
            <Card sx={{ mb: 3, borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <WarningAmberRounded color="warning" />
                  <Box>
                    <Typography variant="subtitle1">Unable to load data</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {error}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ position: "relative" }}>
                <MapSimulation
                  assets={data.assets}
                  crews={data.crews}
                  routes={data.routes}
                  onSelectAsset={setSelectedAsset}
                  selectedAssetId={selectedAsset?.id}
                />
                <FloatingPanels
                  assets={data.assets}
                  priorities={data.priorities}
                  crews={data.crews}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
      <AssetDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </Box>
  );
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#6366f1",
    },
    background: {
      default: "#f1f5f9",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: "'Roboto', 'Inter', 'Helvetica', 'Arial', sans-serif",
    h6: {
      letterSpacing: 0.4,
    },
  },
  shape: {
    borderRadius: 16,
  },
});

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AppContent />
  </ThemeProvider>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
