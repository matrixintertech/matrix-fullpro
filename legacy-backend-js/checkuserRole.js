const { UserModel } = require("./src/modules/user/user-modal");

async function checkUserRole(userId) {
  const user = await UserModel.findById(userId).populate("role");

  if (!user) throw new Error("User not found");

  const isAdmin = Object.values(user.role.permissions).every((perm) => perm);

  if (isAdmin) {
    // console.log("User is an Admin");
    return "admin";
  } else {
    console.log("User is a Matrix User");
    return "matrix_user";
  }
}
checkUserRole("676941fbfa37ce4102551a20");
