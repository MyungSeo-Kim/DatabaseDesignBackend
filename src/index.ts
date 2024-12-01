import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { UserRegister } from "./endpoints/userRegister";
import { UserLogin } from "./endpoints/userLogin";
import { UserProfile } from "./endpoints/userProfile";
import { GroupCreate } from "./endpoints/groupCreate";
import { GroupList } from "./endpoints/groupList";
import { GroupDetail } from "./endpoints/groupDetail";
import { GroupJoin } from "./endpoints/groupJoin";
import { GroupListMine } from "./endpoints/groupListMine";

// Start a Hono app
const app = new Hono();

// CORS 미들웨어 설정
app.use(
    "/*",
    cors({
        origin: "*",
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
        maxAge: 600,
    })
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
    docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/api/users/register", UserRegister);
openapi.post("/api/users/login", UserLogin);
openapi.get("/api/users/profile/:id", UserProfile);
openapi.post("/api/groups", GroupCreate);
openapi.post("/api/groups/:userId", GroupCreate);
openapi.get("/api/groups", GroupList);
openapi.get("/api/groups/my/:userId", GroupListMine);
openapi.get("/api/groups/:groupId", GroupDetail);
openapi.post("/api/groups/:groupId/join", GroupJoin);

export default app;
