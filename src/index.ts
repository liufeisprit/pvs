import fs from "node:fs";
import http from "isomorphic-git/http/node";
import git from "isomorphic-git";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = resolve(fileURLToPath(import.meta.url), '../');

const version: string = JSON.parse(
  fs.readFileSync(`${__dirname}/b2c_public_components/package.json`, "utf-8")
).version;

const author: { name: string; email: string } = (() => {
  let name;
  let email;
  try {
    name = execSync("git config --global user.name");
    email = execSync("git config --global user.email");
  } catch (e) {}
  return {
    name: name?.toString("utf-8").replace(/\s/g, "") || "",
    email: email?.toString("utf-8").replace(/\s/g, "") || "",
  };
})();

const createBranch = async (dir: string, branchName: string) => {
  await git.checkout({
    fs,
    dir,
    ref: "master",
  });
  await git.pull({
    fs,
    http,
    dir,
    ref: "master",
    singleBranch: true,
  });
  await git.branch({ fs, dir, ref: branchName });
  await git.checkout({
    fs,
    dir,
    ref: branchName,
  });
};

const processBranches = async (dir: string, branchName: string) => {
  const currentBranch = await git.currentBranch({
    fs,
    dir,
    fullname: false,
  });
  const localbranches = await git.listBranches({ fs, dir });
  const remoteBranches = await git.listBranches({
    fs,
    dir,
    remote: "origin",
  });
  if (currentBranch != branchName) {
    if (
      localbranches.includes(branchName) &&
      remoteBranches.includes(branchName)
    ) {
      await git.checkout({
        fs,
        dir,
        ref: branchName,
      });
    } else {
      if (!remoteBranches.includes(branchName)) {
        console.error(`你还没在beetle上创建 ${branchName} 分支哦～`);
      } else {
        createBranch(dir, branchName);
      }
    }
  }
};

const getKitVersion = async (dir: string, kitName: string) => {
  const pkgPath = `${dir}/package.json`;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  return pkg?.dependencies?.[kitName] || "";
};

const setKitVersion = async (dir: string, kitName: string, version: string) => {
  if ((await getKitVersion(dir, kitName)) === version) return;
  const pkgPath = `${dir}/package.json`;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.dependencies[kitName] = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
};

const pushBranches = async (dir: string, branchName: string) => {
  await git.add({ fs, dir, filepath: "." });
  await git.commit({
    fs,
    dir,
    author,
    message: "feat: 升级组件库",
  });
  await git.push({
    fs,
    http,
    dir,
    remote: "origin",
    ref: branchName,
    onAuth: () => ({ username: "oauth2", password: "xGh_PG8cbgTNwyg5WPhT" }),
  });
};

const init = (config: Record<string, string>) => {
  Object.entries(config).forEach(async ([projectName, branchName]) => {
    const dir = `${__dirname}/${projectName}`;
    // 处理分支
    await processBranches(dir, branchName);
    // 修改版本
    await setKitVersion(dir, "@zz-yp/b2c-ui", version);
    // 推送分支
    await pushBranches(dir, branchName);
  });
};

export default init;
