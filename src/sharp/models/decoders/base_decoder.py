"""Contains the base class for decoders.

For licensing see accompanying LICENSE file.
Copyright (C) 2025 Apple Inc. All Rights Reserved.
"""
from __future__ import annotations

import abc
from typing import List

import torch
from torch import nn


class BaseDecoder(nn.Module, abc.ABC):
    """Base decoder class."""

    dim_out: int

    @abc.abstractmethod
    def forward(self, encodings: List[torch.Tensor]) -> torch.Tensor:
        """Decode (multi-resolution) encodings."""
