import User from "../models/userModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

export const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    profileImg: req.user.profileImg,
  });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, email, profileImg } = req.body;

  if (email && email !== req.user.email) {
    const exists = await User.findOne({ email });
    if (exists) {
      res.status(409);
      throw new Error("Email already in use");
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      ...(name && { name }),
      ...(email && { email }),
      ...(profileImg !== undefined && { profileImg }),
    },
    { new: true }
  ).select("-password");

  res.status(200).json({
    id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    profileImg: updatedUser.profileImg,
  });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const query = { _id: { $ne: req.user._id } };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // Limit results for performance
  const users = await User.find(query).select("-password").limit(20);

  res.status(200).json(users);
});
